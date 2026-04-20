const STORAGE_KEY = "jnote-library-access";

function getAllBooks() {
    return Object.values(window.BOOK_REGISTRY || {});
}

function getBookById(bookId) {
    return (window.BOOK_REGISTRY || {})[bookId] || null;
}

function readAccessMap() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (error) {
        return {};
    }
}

function getAccessMeta(bookId) {
    const entry = readAccessMap()[bookId];
    if (entry === true) {
        return {
            active: true,
            unlockedAt: null,
            watermarkToken: "LEGACY"
        };
    }
    if (entry && typeof entry === "object") {
        return entry;
    }
    return null;
}

function hasAccess(bookId) {
    const meta = getAccessMeta(bookId);
    return Boolean(meta && meta.active);
}

function revokeAccess(bookId) {
    const current = readAccessMap();
    delete current[bookId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

function grantAccess(bookId, code) {
    const current = readAccessMap();
    const normalizedCode = String(code || "").trim().toUpperCase();
    current[bookId] = {
        active: true,
        unlockedAt: new Date().toISOString(),
        watermarkToken: normalizedCode ? normalizedCode.slice(-4) : Math.random().toString(36).slice(2, 6).toUpperCase()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

function validateBookCode(book, code) {
    return Array.isArray(book.validCodes) && book.validCodes.includes(code.trim().toUpperCase());
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function getWatermarkLabel(book) {
    const meta = getAccessMeta(book.id);
    const token = meta && meta.watermarkToken ? meta.watermarkToken : "LOCKED";
    const issuedAt = meta && meta.unlockedAt
        ? meta.unlockedAt.slice(0, 16).replace("T", " ")
        : new Date().toISOString().slice(0, 16).replace("T", " ");
    return `JNOTE LIBRARY · ${book.title} · ${issuedAt} · ${token}`;
}

function buildWatermarkLayer(label) {
    const text = escapeHtml(label);
    return `
        <div class="secure-watermark-layer" aria-hidden="true">
            <span class="secure-watermark-item">${text}</span>
            <span class="secure-watermark-item">${text}</span>
            <span class="secure-watermark-item">${text}</span>
            <span class="secure-watermark-item">${text}</span>
            <span class="secure-watermark-item">${text}</span>
            <span class="secure-watermark-item">${text}</span>
        </div>
    `;
}

function installContentProtection(target) {
    if (!target || target.__jnoteProtected) {
        return;
    }

    const blockedEvents = ["copy", "cut", "dragstart", "contextmenu", "selectstart"];
    blockedEvents.forEach((eventName) => {
        target.addEventListener(eventName, (event) => {
            event.preventDefault();
        });
    });

    target.__jnoteProtected = true;
}

function installWindowProtection() {
    if (window.__jnoteWindowProtected) {
        return;
    }

    window.addEventListener("keydown", (event) => {
        const key = event.key ? event.key.toLowerCase() : "";
        if ((event.ctrlKey || event.metaKey) && ["c", "p", "s", "u"].includes(key)) {
            event.preventDefault();
        }
        if (key === "printscreen") {
            event.preventDefault();
        }
    });

    window.addEventListener("beforeprint", () => {
        document.body.classList.add("is-print-blocked");
    });

    window.addEventListener("afterprint", () => {
        document.body.classList.remove("is-print-blocked");
    });

    window.__jnoteWindowProtected = true;
}

function isPurchaseUrlReady(url) {
    return !url.includes("YOUR-LIVEKLASS");
}

function openPurchase(book) {
    if (!book.purchaseUrl) {
        alert("이 전자책은 현재 제작 중입니다.");
        return;
    }
    if (!isPurchaseUrlReady(book.purchaseUrl)) {
        alert("해당 전자책의 purchaseUrl 값을 실제 판매 링크로 교체해 주세요.");
        return;
    }
    window.open(book.purchaseUrl, "_blank", "noopener");
}

function createBookCard(book) {
    const isPublished = book.status === "published";
    const unlocked = isPublished && hasAccess(book.id);
    const isPrimaryBook = book.id === "resume-master-book";
    const statusClass = !isPublished ? "status-locked" : unlocked ? "status-unlocked" : "status-locked";
    const statusText = !isPublished ? "출간 예정" : unlocked ? "열람 가능" : "미리보기 제공";
    const accessText = !isPublished ? "현재 제작 중입니다" : unlocked ? "전체 열람 가능" : isPrimaryBook ? "샘플 열람 가능" : "샘플 공개 10%";
    const availabilityClass = !isPublished ? "book-availability is-coming-soon" : "book-availability";
    const cardClass = !isPublished ? "book-card is-coming-soon" : "book-card";
    const thumbClass = !isPublished ? "book-thumb is-coming-soon" : isPrimaryBook ? "book-thumb is-primary-book" : "book-thumb";
    const cardDescription = isPrimaryBook
        ? unlocked
            ? "스펙이 아니라 문장 구조가 합격률을 바꿉니다. 비전공자, 국비지원, 중소기업 경험도 서류와 면접에서 통하는 언어로 다시 정리한 실전 전자책입니다."
            : "스펙이 부족해서 떨어지는 것이 아니라, 경험을 합격 문장으로 바꾸는 방법을 몰랐기 때문입니다. 먼저 샘플로 흐름을 확인한 뒤 전체 열람으로 이어갈 수 있습니다."
        : book.description;
    const readAction = isPublished
        ? unlocked
            ? `<a class="button button-primary" href="./book.html?book=${book.id}&read=1">전자책 읽기</a>`
            : `<button class="button button-primary" type="button" data-book-id="${book.id}" data-action="open-reader">샘플 보기</button>`
        : "";
    const actions = isPublished
        ? `
                <div class="book-actions">
                    <a class="button button-secondary" href="./book-intro.html?book=${book.id}">전자책 소개</a>
                    ${readAction}
                </div>
            `
        : "";
    const primaryHeading = isPrimaryBook
        ? `
                <div class="book-card-heading">
                    <h3>${book.title}</h3>
                    <p class="book-card-subtitle">${book.subtitle}</p>
                </div>
            `
        : "";
    return `
        <article class="${cardClass}">
            <div class="${thumbClass}">
                <span class="status-pill ${statusClass}">${statusText}</span>
                ${!isPublished ? "" : `<img src="${book.accentImage}" alt="${book.title} 썸네일">`}
                <div class="book-thumb-copy ${isPrimaryBook ? "is-hidden-copy" : ""}">
                    <h3>${book.title}</h3>
                    <p class="book-thumb-subtitle">${book.subtitle}</p>
                </div>
            </div>
            <div class="book-card-info">
                ${primaryHeading}
                <div class="${availabilityClass}">${accessText}</div>
                <p>${cardDescription}</p>
                ${actions}
            </div>
        </article>
    `;
}

function openReaderGateModal(book) {
    const existing = document.getElementById("readerGateModal");
    if (existing) {
        existing.remove();
    }

    const modal = document.createElement("div");
    modal.id = "readerGateModal";
    modal.className = "modal-backdrop";
    modal.innerHTML = `
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="readerGateTitle">
            <h3 id="readerGateTitle">구매되지 않은 전자책입니다.</h3>
            <p>
                전체 전자책을 읽으려면 구매 후 받은 코드를 입력해야 합니다. 먼저 샘플을 확인한 뒤 같은 페이지에서 코드를 입력할 수 있습니다.
            </p>
            <div class="modal-code-box">
                <strong style="display:block; margin-bottom:8px;">이용 안내</strong>
                <p>
                    샘플 보기로 들어가면 공개된 구간을 먼저 확인할 수 있고, 아래에서 바로 코드 인증을 진행할 수 있습니다.
                </p>
            </div>
            <div class="book-actions">
                <button class="button button-secondary" type="button" data-modal-action="close">닫기</button>
                <a class="button button-primary" href="./book.html?book=${book.id}&preview=1">샘플 보기</a>
            </div>
        </div>
    `;

    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            modal.remove();
        }
    });

    modal.querySelector('[data-modal-action="close"]').addEventListener("click", () => {
        modal.remove();
    });

    document.body.appendChild(modal);
}

function renderLibraryPage() {
    const list = document.getElementById("bookList");
    if (!list) {
        return;
    }

    list.innerHTML = getAllBooks().map(createBookCard).join("");
    list.querySelectorAll('[data-action="open-reader"]').forEach((button) => {
        button.addEventListener("click", () => {
            const book = getBookById(button.dataset.bookId);
            if (book) {
                openReaderGateModal(book);
            }
        });
    });
    list.querySelectorAll('[data-action="purchase"]').forEach((button) => {
        button.addEventListener("click", () => {
            const book = getBookById(button.dataset.bookId);
            if (book) {
                openPurchase(book);
            }
        });
    });
    list.querySelectorAll('[data-action="coming-soon"]').forEach((button) => {
        button.addEventListener("click", () => {
            alert("현재 제작 중인 전자책입니다.");
        });
    });
}

function renderIntroPage() {
    const params = new URLSearchParams(window.location.search);
    const bookId = params.get("book");
    const book = getBookById(bookId);

    if (!book) {
        const introApp = document.getElementById("introApp");
        if (introApp) {
            introApp.innerHTML = `
                <section class="section" style="padding-top:56px;">
                    <div class="shell">
                        <article class="empty-state">
                            <h2>전자책을 찾을 수 없습니다.</h2>
                            <p>책장으로 돌아가서 유효한 전자책을 선택해 주세요.</p>
                            <div class="book-actions" style="justify-content:center;">
                                <a class="button button-primary" href="./library.html">책장으로 이동</a>
                            </div>
                        </article>
                    </div>
                </section>
            `;
        }
        return;
    }

    document.title = `${book.title} 소개 | JNOTE LIBRARY`;
    const isPublished = book.status === "published";
    const unlocked = isPublished && hasAccess(book.id);
    const introApp = document.getElementById("introApp");

    if (book.id === "resume-master-book") {
        introApp.innerHTML = `
            <section class="intro-sales-hero">
                <div class="shell intro-sales-grid">
                    <div>
                        <div class="eyebrow">비전공자 · 국비지원 · 중소기업 경력을 위한 합격 문장 설계도</div>
                        <h1>당신이 계속 떨어지는 이유는 경험이 부족해서가 아니라, 그 경험을 합격 문장으로 바꾸는 구조가 없었기 때문입니다.</h1>
                        <p class="hero-copy">
                            이 전자책은 자기소개서를 예쁘게 쓰는 법을 설명하는 책이 아닙니다.
                            평범해 보이는 경험을 기업이 이해하는 언어로 재번역하고, 서류와 면접에서 통하는
                            합격 문장으로 바꾸는 구조를 바로 적용할 수 있게 정리한 실전용 설계도입니다.
                        </p>
                        <div class="hero-actions">
                            <a class="button button-primary" href="${unlocked ? `./book.html?book=${book.id}&read=1` : `./book.html?book=${book.id}`}">${unlocked ? "전자책 읽기" : "전자책 샘플 보기"}</a>
                            <a class="button button-secondary" href="./library.html">책장으로 돌아가기</a>
                        </div>
                        <div class="trust-strip">
                            <div class="trust-item">
                                <strong>구조 중심 설계</strong>
                                <span>감이 아니라 PARL과 STAR 구조로 다시 쓰는 흐름을 정리했습니다.</span>
                            </div>
                            <div class="trust-item">
                                <strong>서류와 면접 연결</strong>
                                <span>자기소개서 문장이 면접 답변까지 이어지도록 설계했습니다.</span>
                            </div>
                            <div class="trust-item">
                                <strong>웹북 열람형</strong>
                                <span>구매 후 바로 열람하고 필요할 때마다 다시 꺼내 볼 수 있습니다.</span>
                            </div>
                        </div>
                    </div>
                    <div class="hero-card">
                        <article class="book-cover">
                            <img src="${book.coverImage}" alt="${book.title}">
                            <span class="cover-label">Resume Language Playbook</span>
                            <h2>${book.title}</h2>
                            <p class="cover-copy">
                                작은 프로젝트, 보조 업무, 평범한 국비지원 경험도
                                합격 가능한 문장 구조로 바꾸면 결과는 달라집니다.
                                이 전자책은 그 치환 과정을 문장 단위로 바로 보여줍니다.
                            </p>
                            <div class="cover-stats">
                                <div class="cover-stat">
                                    <strong>9,900원</strong>
                                    <span>가볍게 시작</span>
                                </div>
                                <div class="cover-stat">
                                    <strong>즉시 적용</strong>
                                    <span>바로 써먹는 문장 구조</span>
                                </div>
                                <div class="cover-stat">
                                    <strong>웹 열람</strong>
                                    <span>구매 후 바로 확인</span>
                                </div>
                            </div>
                        </article>
                    </div>
                </div>
            </section>

            <section class="story-band">
                <div class="shell story-frame">
                    <h2 class="story-quote">
                        대단한 프로젝트가 없어서 떨어지는 것이 아닙니다.<br>
                        작성 방식이 잘못되었을 뿐입니다.
                    </h2>

                    <article class="story-card feature-card">
                        <p>
                            수십 번 서류 탈락을 겪으며, 국비지원 수준의 평범한 프로젝트로는 한계가 있다고 생각했습니다.
                            맡은 역할도 작았고, 내세울 만한 기술적 깊이도 부족했습니다.
                        </p>

                        <div class="story-highlight">
                            <p>
                                원인을 찾기 위해 현직 시니어 개발자에게 이력서 리뷰를 요청했고, 피드백은 명확했습니다.
                                <strong style="color:#2563eb;">기능 구현 나열만 있고, 이 코드가 회사에 어떤 비즈니스 임팩트를 주는지 보이지 않는다는 것.</strong>
                                기업이 원하는 건 무엇을 만들었는지가 아니라, 어떤 문제를 어떻게 해결했는지입니다.
                            </p>
                        </div>

                        <p>
                            그날 이후 이력서의 모든 문장을 구조화했습니다. 게시판 CRUD를 구현했습니다라는 나열을
                            조회 쿼리 개선을 통해 로딩 속도를 단축하여 사용자 경험을 개선했습니다라는 기업의 언어로 치환했고,
                            그 결과 서류 통과율이 달라졌습니다.
                        </p>
                    </article>

                    <div class="proof-grid">
                        <article class="proof-card">
                            <img src="./img/고교 성적 인증사진.png" alt="9등급 인증">
                            <span>실제 고교 성적 9등급 인증</span>
                        </article>
                        <article class="proof-card">
                            <img src="./img/사회복지사 인증사진.png" alt="사회복지사 전공 인증">
                            <span>사회복지사 전공 인증</span>
                        </article>
                    </div>
                </div>
            </section>

            <section class="section">
                <div class="shell">
                    <div class="section-head">
                        <div>
                            <h2>이 전자책에서 바로 가져갈 수 있는 3가지</h2>
                        </div>
                        <p>추상적인 조언보다, 실제 이력서 문장을 바꾸는 기준과 예시 위주로 정리했습니다.</p>
                    </div>
                    <div class="landing-solution-grid">
                        <article class="landing-solution-card feature-card">
                            <div class="accent-number">Point 1</div>
                            <strong>작은 경험의 강점 찾기</strong>
                            <p>국비지원 팀 프로젝트의 작은 역할, 개인 실습, 보조 업무 같은 평범한 경험도 면접관이 읽는 성과 사례로 바꾸는 기준을 제공합니다.</p>
                        </article>
                        <article class="landing-solution-card feature-card">
                            <div class="accent-number">Point 2</div>
                            <strong>이력서 합격 문장 공식</strong>
                            <p>열심히 했습니다, 소통을 잘합니다 같은 애매한 표현을 빼고 회사가 뽑고 싶어지는 성과 문장으로 바꾸는 법을 담았습니다.</p>
                        </article>
                        <article class="landing-solution-card feature-card is-primary">
                            <div class="accent-number">Point 3</div>
                            <strong>이력서와 면접 답변을 동시에 연결하는 프로세스</strong>
                            <p>STAR 템플릿에 맞춰 빈칸만 채우면 서류용 문장과 면접 답변, 꼬리 질문 대응까지 한 번에 정리되도록 설계했습니다.</p>
                        </article>
                    </div>
                </div>
            </section>

            <section class="cta-band">
                <div class="shell">
                    <div class="cta-wrap">
                        <h2>
                            효율이 떨어지는 자소서 첨삭에<br>
                            돈과 시간을 낭비하지 마세요.
                        </h2>
                        <p>복잡한 첨삭 없이도 문장 공식을 알면 평범한 경험이 합격권 이력서로 훨씬 빠르게 정리됩니다.</p>

                        <article class="price-card">
                            <div class="price-number">9,900<span>원</span></div>
                            <div class="hero-actions" style="justify-content:center;">
                                <a class="button button-primary" href="${unlocked ? `./book.html?book=${book.id}&read=1` : `./book.html?book=${book.id}&focus=code`}">${unlocked ? "전자책 읽기" : "전자책 열기"}</a>
                                <button class="button button-secondary" type="button" id="introPurchaseButton">구매 링크 열기</button>
                            </div>
                            <div class="price-note">
                                결제 후 발급받은 코드로 바로 열람할 수 있습니다.<br>
                                필요할 때마다 다시 열어 문장을 복기하고 바로 자기 이력서에 적용할 수 있습니다.
                            </div>
                        </article>
                    </div>
                </div>
            </section>
        `;

        const introPurchaseButton = document.getElementById("introPurchaseButton");
        if (introPurchaseButton) {
            introPurchaseButton.addEventListener("click", () => openPurchase(book));
        }
        return;
    }

    const featureCards = [
        {
            title: "이 전자책에서 얻는 것",
            body: isPublished
                ? "작은 경험을 기업이 읽는 성과 문장으로 바꾸는 프레임과 샘플을 바로 확인할 수 있습니다."
                : "현재 기획 중인 전자책의 방향과 핵심 주제를 먼저 확인할 수 있습니다."
        },
        {
            title: "추천 대상",
            body: "비전공자, 국비지원 수강생, 이력서 문장을 다듬고 싶은 주니어, 면접 답변까지 함께 정리하고 싶은 지원자."
        },
        {
            title: "열람 방식",
            body: isPublished
                ? "책장 진입 후 코드 인증으로 전체 열람, 모바일 읽기 모드와 원본 레이아웃을 모두 지원합니다."
                : "출간 전까지는 소개만 제공되며, 오픈 후 책장에서 바로 열람할 수 있습니다."
        }
    ].map((item) => `
        <article class="intro-feature">
            <strong>${item.title}</strong>
            <p>${item.body}</p>
        </article>
    `).join("");

    introApp.innerHTML = `
        <section class="intro-hero">
            <div class="shell intro-grid">
                <article class="reader-book-head">
                    <img src="${book.coverImage}" alt="${book.title}">
                    <span class="cover-label">${isPublished ? "Published" : "Coming Soon"}</span>
                    <h1>${book.title}</h1>
                    <p>${book.subtitle}</p>
                    <div class="tag-row">
                        ${book.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
                    </div>
                </article>
                <article class="detail-card intro-summary">
                    <h1>${book.title}</h1>
                    <p>${book.description}</p>
                    <div class="intro-status-box">
                        <strong>${isPublished ? "지금 바로 열람 가능한 전자책입니다." : "현재 제작 중인 전자책입니다."}</strong>
                        <p>
                            ${isPublished
                                ? "책장에서 전자책 열기를 누르면 샘플 미리보기와 코드 기반 전체 열람으로 이어집니다."
                                : "오픈 전까지는 소개 정보만 제공됩니다. 출간 후에는 같은 위치에서 바로 열람할 수 있습니다."}
                        </p>
                    </div>
                    <div class="book-actions">
                        <a class="button button-secondary" href="./library.html">책장으로 돌아가기</a>
                        ${isPublished
                            ? `<a class="button button-primary" href="${unlocked ? `./book.html?book=${book.id}&read=1` : `./book.html?book=${book.id}&focus=code`}">${unlocked ? "전자책 읽기" : "전자책 열기"}</a>
                               <button class="button button-dark" type="button" id="introPurchaseButton">구매 링크 열기</button>`
                            : `<button class="button button-primary" type="button" id="introSoonButton">현재 제작 중</button>`}
                    </div>
                </article>
            </div>
        </section>

        <section class="section">
            <div class="shell">
                <div class="section-head">
                    <div>
                        <h2>전자책 소개</h2>
                    </div>
                    <p>책장에서는 전자책을 고르기 쉽게, 소개 페이지에서는 이 책이 어떤 사람에게 어떤 도움을 주는지 빠르게 판단할 수 있게 구성했습니다.</p>
                </div>
                <div class="intro-feature-grid">
                    ${featureCards}
                </div>
            </div>
        </section>
    `;

    const introPurchaseButton = document.getElementById("introPurchaseButton");
    if (introPurchaseButton) {
        introPurchaseButton.addEventListener("click", () => openPurchase(book));
    }

    const introSoonButton = document.getElementById("introSoonButton");
    if (introSoonButton) {
        introSoonButton.addEventListener("click", () => {
            alert("현재 제작 중인 전자책입니다.");
        });
    }
}

function renderContentBlocks(container, blocks) {
    container.innerHTML = blocks.map((block) => {
        const paragraphs = block.paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");
        const bullets = block.bullets
            ? `<ul>${block.bullets.map((bullet) => `<li>${bullet}</li>`).join("")}</ul>`
            : "";
        return `
            <article class="content-block">
                <span class="block-label">${block.label}</span>
                <h4>${block.heading}</h4>
                ${paragraphs}
                ${bullets}
            </article>
        `;
    }).join("");
}

function mountBookFrame(container, book, mode = "original", options = {}) {
    const configuredHeight = book.frameHeight && book.frameHeight.original ? book.frameHeight.original : 7800;
    const watermarkLabel = getWatermarkLabel(book);
    const previewPages = options.previewPages || 0;
    const previewModeClass = previewPages ? " ebook-frame-wrap-preview" : "";
    const initialPreviewHeight = previewPages ? Math.min(configuredHeight, 3600) : 0;
    container.innerHTML = `
        <div class="ebook-frame-wrap secure-reader-surface${previewModeClass}">
            ${buildWatermarkLayer(watermarkLabel)}
            <div class="${previewPages ? "ebook-preview-clip" : ""}" ${previewPages ? `data-preview-pages="${previewPages}" style="height:${initialPreviewHeight}px;"` : ""}>
                <iframe class="ebook-frame" src="${book.fullSource}" title="${book.title} 전체 전자책" scrolling="no" style="height:${configuredHeight}px;"></iframe>
            </div>
        </div>
    `;

    installContentProtection(container.querySelector(".secure-reader-surface"));
    const frame = container.querySelector(".ebook-frame");
    const previewClip = container.querySelector(".ebook-preview-clip");
    if (!frame) {
        return;
    }

    const resizeFrame = () => {
        try {
            const doc = frame.contentDocument || frame.contentWindow.document;
            if (!doc) {
                return;
            }
            const bodyHeight = doc.body ? doc.body.scrollHeight : 0;
            const docHeight = doc.documentElement ? doc.documentElement.scrollHeight : 0;
            frame.style.height = `${Math.max(bodyHeight, docHeight, configuredHeight)}px`;
        } catch (error) {
            frame.style.height = `${configuredHeight}px`;
        }
    };

    const applyPreviewHeight = () => {
        if (!previewClip || !previewPages) {
            return;
        }
        try {
            const doc = frame.contentDocument || frame.contentWindow.document;
            if (!doc) {
                return;
            }
            const pages = Array.from(doc.querySelectorAll(".page"));
            if (pages.length) {
                const targetPage = pages[Math.min(previewPages, pages.length) - 1];
                const rectTop = targetPage.offsetTop;
                const rectHeight = targetPage.offsetHeight;
                const clippedHeight = rectTop + rectHeight + 24;
                previewClip.style.height = `${clippedHeight}px`;
                return;
            }
            previewClip.style.height = `${Math.min(configuredHeight, 3400)}px`;
        } catch (error) {
            previewClip.style.height = `${Math.min(configuredHeight, 3400)}px`;
        }
    };

    const applyFrameTheme = () => {
        try {
            const doc = frame.contentDocument || frame.contentWindow.document;
            if (!doc) {
                return;
            }

            const styleId = "jnote-viewer-override";
            let styleTag = doc.getElementById(styleId);
            if (!styleTag) {
                styleTag = doc.createElement("style");
                styleTag.id = styleId;
                doc.head.appendChild(styleTag);
            }

            const sharedCss = `
                html {
                    -webkit-user-select: none !important;
                    user-select: none !important;
                    -webkit-touch-callout: none !important;
                }
                body {
                    display: block !important;
                    margin: 0 !important;
                    padding: 18px 0 24px !important;
                    min-height: auto !important;
                    gap: 0 !important;
                    align-items: initial !important;
                    justify-content: initial !important;
                }
                .page {
                    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05) !important;
                    margin: 0 auto 18px auto !important;
                }
                .page:last-child {
                    margin-bottom: 0 !important;
                }
                img, svg {
                    -webkit-user-drag: none !important;
                    user-drag: none !important;
                    pointer-events: none !important;
                }
                @media print {
                    body * {
                        display: none !important;
                    }
                    body::before {
                        content: "인쇄가 제한된 전자책입니다.";
                        display: block !important;
                        padding: 120px 32px !important;
                        text-align: center !important;
                        color: #0f172a !important;
                        font: 700 24px/1.6 'Noto Sans KR', sans-serif !important;
                    }
                }
            `;

            const mobileCss = `
                body {
                    padding: 16px 0 !important;
                }
                .page {
                    width: min(100% - 24px, 860px) !important;
                    min-width: 0 !important;
                    max-width: 860px !important;
                    height: auto !important;
                    min-height: 0 !important;
                    max-height: none !important;
                    aspect-ratio: 210 / 297 !important;
                }
            `;

            const originalCss = `
                .page {
                    width: 210mm !important;
                    min-width: 210mm !important;
                    max-width: 210mm !important;
                    height: 297mm !important;
                    min-height: 297mm !important;
                    max-height: 297mm !important;
                    aspect-ratio: 210 / 297 !important;
                }
            `;

            styleTag.textContent = sharedCss + (mode === "mobile" ? mobileCss : originalCss);
        } catch (error) {
            /* same-origin failure fallback */
        }
    };

    const installResizeObserver = () => {
        try {
            const doc = frame.contentDocument || frame.contentWindow.document;
            if (!doc || !doc.body || !doc.documentElement) {
                return;
            }

            const resize = () => {
                applyFrameTheme();
                resizeFrame();
                applyPreviewHeight();
            };

            if (!frame.__jnoteObserverInstalled && "ResizeObserver" in window) {
                const observer = new ResizeObserver(() => resize());
                observer.observe(doc.body);
                observer.observe(doc.documentElement);
                frame.__jnoteObserverInstalled = true;
            }

            let attempts = 0;
            const interval = setInterval(() => {
                resize();
                attempts += 1;
                if (attempts >= 12) {
                    clearInterval(interval);
                }
            }, 250);
        } catch (error) {
            /* ignore */
        }
    };

    frame.addEventListener("load", () => {
        applyFrameTheme();
        resizeFrame();
        applyPreviewHeight();
        installResizeObserver();
        installContentProtection(frame.contentDocument);
        setTimeout(() => {
            applyFrameTheme();
            resizeFrame();
            applyPreviewHeight();
        }, 120);
        setTimeout(() => {
            applyFrameTheme();
            resizeFrame();
            applyPreviewHeight();
        }, 600);
    });
}

function renderReaderModeContent(container, book, mode) {
    if (mode === "mobile") {
        const mobileBlocks = book.mobileBlocks && book.mobileBlocks.length ? book.mobileBlocks : book.lockedBlocks;
        const watermarkLabel = getWatermarkLabel(book);
        container.innerHTML = `
            <div class="mobile-reader-wrap secure-reader-surface">
                ${buildWatermarkLayer(watermarkLabel)}
                <article class="content-block">
                    <span class="block-label">Responsive Reader</span>
                    <h4>모바일 화면에 맞게 실제 전자책 내용을 다시 배치한 읽기 모드입니다.</h4>
                    <p>작은 화면에서는 A4 원본보다 이 모드가 훨씬 읽기 좋습니다. 내용은 요약이 아니라 전자책의 핵심 본문 흐름을 따라 재구성되어 있습니다.</p>
                </article>
                <div id="mobileReaderBlocks"></div>
            </div>
        `;
        installContentProtection(container.querySelector(".secure-reader-surface"));
        renderContentBlocks(document.getElementById("mobileReaderBlocks"), mobileBlocks);
        return;
    }

    if (book.fullSource) {
        mountBookFrame(container, book, mode);
        return;
    }

    container.innerHTML = `<div id="unlockedBlocks"></div>`;
    renderContentBlocks(document.getElementById("unlockedBlocks"), book.lockedBlocks);
}

function renderViewerPage() {
    const params = new URLSearchParams(window.location.search);
    const bookId = params.get("book");
    const book = getBookById(bookId);
    const viewerApp = document.getElementById("viewerApp");

    if (!book || book.status !== "published") {
        viewerApp.innerHTML = `
            <section class="section" style="padding-top:56px;">
                <div class="shell">
                    <article class="empty-state">
                        <h2>전자책을 찾을 수 없습니다.</h2>
                        <p>유효한 전자책만 전용 뷰어에서 열 수 있습니다.</p>
                    </article>
                </div>
            </section>
        `;
        return;
    }

    if (!hasAccess(book.id)) {
        viewerApp.innerHTML = `
            <section class="section" style="padding-top:56px;">
                <div class="shell">
                    <article class="empty-state">
                        <h2>열람 권한이 없습니다.</h2>
                        <p>구매 후 받은 코드를 먼저 등록한 뒤 다시 열어 주세요.</p>
                        <div class="book-actions" style="justify-content:center;">
                            <a class="button button-primary" href="./book.html?book=${book.id}&focus=code">코드 입력하기</a>
                        </div>
                    </article>
                </div>
            </section>
        `;
        return;
    }

    document.title = `${book.title} Viewer | JNOTE LIBRARY`;
    const defaultMode = "original";
    installWindowProtection();

    viewerApp.innerHTML = `
        <section class="reader-hero">
            <div class="shell">
                <div class="reader-top reader-shell" style="margin-top:0;">
                    <div class="reader-title">
                        <strong>${book.title}</strong>
                        <span>구매가 완료된 전자책 전용 뷰어입니다. 복사, 우클릭, 인쇄는 제한됩니다.</span>
                    </div>
                </div>
                <div id="viewerModeContent"></div>
            </div>
        </section>
    `;

    const viewerModeContent = document.getElementById("viewerModeContent");
    renderReaderModeContent(viewerModeContent, book, defaultMode);
}

function renderReaderPage() {
    const params = new URLSearchParams(window.location.search);
    const bookId = params.get("book");
    const previewOnly = params.get("preview") === "1";
    const focusCode = params.get("focus") === "code";
    const readDirect = params.get("read") === "1";
    const book = getBookById(bookId);

    if (!book) {
        const missing = document.getElementById("readerApp");
        if (missing) {
            missing.innerHTML = `
                <section class="section">
                    <div class="shell">
                        <article class="empty-state">
                            <h2>전자책을 찾을 수 없습니다.</h2>
                            <p>책장으로 돌아가서 유효한 전자책을 선택해 주세요.</p>
                            <div class="book-actions" style="justify-content:center;">
                                <a class="button button-primary" href="./library.html">책장으로 이동</a>
                            </div>
                        </article>
                    </div>
                </section>
            `;
        }
        return;
    }

    document.title = `${book.title} | JNOTE LIBRARY`;

    if (book.status !== "published") {
        const readerApp = document.getElementById("readerApp");
        readerApp.innerHTML = `
            <section class="section" style="padding-top:56px;">
                <div class="shell">
                    <article class="empty-state">
                        <h2>${book.title}</h2>
                        <p>이 전자책은 현재 제작 중입니다. 오픈되면 책장에서 바로 열람할 수 있습니다.</p>
                        <div class="book-actions" style="justify-content:center;">
                            <a class="button button-primary" href="./library.html">책장으로 돌아가기</a>
                        </div>
                    </article>
                </div>
            </section>
        `;
        return;
    }

    const unlocked = hasAccess(book.id);
    if (unlocked && previewOnly) {
        window.location.replace(`./book.html?book=${encodeURIComponent(book.id)}&read=1`);
        return;
    }

    const readerApp = document.getElementById("readerApp");
    const defaultMode = "original";
    readerApp.innerHTML = `
        <section class="section">
            <div class="shell">
                <section class="code-card" id="codeAccess">
                    <div>
                        <strong>구매 후 받은 코드를 입력하세요.</strong>
                        <p class="code-help">
                            회원가입 없이 이 브라우저에 열람 권한을 저장합니다. 한 번 인증되면 같은 브라우저에서는 다시 입력하지 않아도 됩니다.
                            테스트용 데모 코드는 ${book.validCodes[0]} 입니다.
                        </p>
                        <div id="savedAccessNote" class="code-help hidden"></div>
                        <div id="codeFeedback" class="code-feedback"></div>
                    </div>
                    <form id="codeForm">
                        <input id="accessCodeInput" class="code-input" name="accessCode" placeholder="구매 후 받은 코드 입력" autocomplete="off">
                        <button class="button button-primary" type="submit" id="submitCodeButton">코드 인증</button>
                        <button class="button button-secondary hidden" type="button" id="resetAccessButton">이 브라우저 권한 삭제</button>
                    </form>
                </section>

                <section class="reader-shell" id="reader">
                    <div class="reader-top">
                        <div class="reader-title">
                            <strong>${book.title}</strong>
                            <span id="readerStatusText">${unlocked ? "전체 원고가 열려 있습니다." : "샘플 미리보기만 열려 있습니다."}</span>
                        </div>
                        <div class="book-actions">
                            <a class="button button-secondary" href="./library.html">책장으로 돌아가기</a>
                            <button class="button button-secondary" type="button" id="focusCodeButton">코드 입력</button>
                            <button class="button button-dark" type="button" id="floatingPurchaseButton">구매 링크 열기</button>
                        </div>
                    </div>
                    <div class="reader-body">
                        <div id="previewReader" class="${unlocked ? "hidden" : ""}"></div>
                        <div id="lockedSection" class="${unlocked ? "hidden" : "locked-stack"}">
                            <div class="locked-overlay" id="lockedOverlay">
                                <div class="locked-panel">
                                    <strong>전체 전자책은 잠겨 있습니다.</strong>
                                    <p>샘플은 앞부분 3페이지만 공개됩니다. 구매 완료 후 받은 코드를 입력하면 전체 전자책이 즉시 열립니다.</p>
                                    <div class="hero-actions" style="justify-content:center;">
                                        <button class="button button-primary" type="button" id="overlayCodeButton">코드 입력하기</button>
                                        <button class="button button-secondary" type="button" id="overlayPurchaseButton">구매 링크</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div id="unlockedSection" class="${unlocked ? "" : "hidden"}">
                            <div id="readerModeContent"></div>
                        </div>
                    </div>
                </section>
                <div class="reader-float-nav" aria-label="페이지 이동">
                    <button class="reader-float-button" type="button" id="scrollTopButton">맨 위로</button>
                    <button class="reader-float-button" type="button" id="scrollBottomButton">맨 아래로</button>
                </div>
            </div>
        </section>
    `;

    const previewReader = document.getElementById("previewReader");
    if (book.fullSource) {
        mountBookFrame(previewReader, book, "original", { previewPages: 3 });
    } else {
        renderContentBlocks(previewReader, book.previewBlocks);
    }

    const feedback = document.getElementById("codeFeedback");
    const form = document.getElementById("codeForm");
    const input = document.getElementById("accessCodeInput");
    const submitCodeButton = document.getElementById("submitCodeButton");
    const savedAccessNote = document.getElementById("savedAccessNote");
    const resetAccessButton = document.getElementById("resetAccessButton");
    const lockedSection = document.getElementById("lockedSection");
    const unlockedSection = document.getElementById("unlockedSection");
    const readerStatusText = document.getElementById("readerStatusText");
    const readerModeContent = document.getElementById("readerModeContent");
    const focusCodeButton = document.getElementById("focusCodeButton");
    const floatingPurchaseButton = document.getElementById("floatingPurchaseButton");
    const overlayCodeButton = document.getElementById("overlayCodeButton");
    const overlayPurchaseButton = document.getElementById("overlayPurchaseButton");
    const scrollTopButton = document.getElementById("scrollTopButton");
    const scrollBottomButton = document.getElementById("scrollBottomButton");
    let currentMode = defaultMode;

    function applyReaderMode(mode) {
        currentMode = mode;
        renderReaderModeContent(readerModeContent, book, mode);
    }

    function setFeedback(message, type) {
        feedback.textContent = message;
        feedback.className = `code-feedback ${type ? `feedback-${type}` : ""}`;
    }

    function syncReaderState() {
        const open = hasAccess(book.id);
        const accessMeta = getAccessMeta(book.id);
        if (open) {
            installWindowProtection();
            previewReader.className = "hidden";
            lockedSection.className = "hidden";
            unlockedSection.className = "";
            readerStatusText.textContent = "전체 원고가 열려 있습니다.";
            input.disabled = true;
            input.value = "";
            input.placeholder = "인증이 완료된 브라우저입니다";
            if (submitCodeButton) {
                submitCodeButton.disabled = true;
                submitCodeButton.textContent = "인증 완료";
            }
            if (focusCodeButton) {
                focusCodeButton.disabled = true;
                focusCodeButton.textContent = "인증 완료";
            }
            if (floatingPurchaseButton) {
                floatingPurchaseButton.className = "button button-dark hidden";
            }
            if (overlayCodeButton) {
                overlayCodeButton.disabled = true;
            }
            if (overlayPurchaseButton) {
                overlayPurchaseButton.className = "button button-secondary hidden";
            }
            if (savedAccessNote) {
                const issuedAt = accessMeta && accessMeta.unlockedAt
                    ? new Date(accessMeta.unlockedAt).toLocaleString("ko-KR")
                    : "방금";
                savedAccessNote.textContent = `이 브라우저에 열람 권한이 저장되어 있습니다. 인증 시각: ${issuedAt}`;
                savedAccessNote.className = "code-help";
            }
            if (resetAccessButton) {
                resetAccessButton.className = "button button-secondary";
            }
            setFeedback("코드 인증이 완료되어 전체 열람이 가능합니다.", "success");
            applyReaderMode(currentMode);
        } else {
            previewReader.className = "";
            lockedSection.className = "locked-stack";
            unlockedSection.className = "hidden";
            readerStatusText.textContent = "샘플 미리보기만 열려 있습니다.";
            input.disabled = false;
            input.placeholder = "구매 후 받은 코드 입력";
            if (submitCodeButton) {
                submitCodeButton.disabled = false;
                submitCodeButton.textContent = "코드 인증";
            }
            if (focusCodeButton) {
                focusCodeButton.disabled = false;
                focusCodeButton.textContent = "코드 입력";
            }
            if (floatingPurchaseButton) {
                floatingPurchaseButton.className = "button button-dark";
            }
            if (overlayCodeButton) {
                overlayCodeButton.disabled = false;
            }
            if (overlayPurchaseButton) {
                overlayPurchaseButton.className = "button button-secondary";
            }
            if (savedAccessNote) {
                savedAccessNote.textContent = "";
                savedAccessNote.className = "code-help hidden";
            }
            if (resetAccessButton) {
                resetAccessButton.className = "button button-secondary hidden";
            }
            setFeedback("", "");
        }
    }

    function focusCodeInput() {
        document.getElementById("codeAccess").scrollIntoView({ behavior: "smooth", block: "center" });
        input.focus();
    }

    function scrollToTop() {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function scrollToBottom() {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const code = input.value.trim().toUpperCase();

        if (!code) {
            setFeedback("코드를 입력해 주세요.", "error");
            return;
        }

        if (!validateBookCode(book, code)) {
            setFeedback("유효하지 않은 코드입니다. 구매 후 받은 코드를 다시 확인해 주세요.", "error");
            return;
        }

        grantAccess(book.id, code);
        input.value = "";
        syncReaderState();
        document.getElementById("reader").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    [
        focusCodeButton,
        overlayCodeButton
    ].forEach((button) => {
        if (button) {
            button.addEventListener("click", focusCodeInput);
        }
    });

    if (resetAccessButton) {
        resetAccessButton.addEventListener("click", () => {
            revokeAccess(book.id);
            setFeedback("이 브라우저에 저장된 열람 권한을 삭제했습니다.", "success");
            syncReaderState();
            document.getElementById("reader").scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }

    if (scrollTopButton) {
        scrollTopButton.addEventListener("click", scrollToTop);
    }

    if (scrollBottomButton) {
        scrollBottomButton.addEventListener("click", scrollToBottom);
    }

    [
        floatingPurchaseButton,
        overlayPurchaseButton
    ].forEach((button) => {
        if (button) {
            button.addEventListener("click", () => openPurchase(book));
        }
    });

    syncReaderState();

    if (!unlocked && focusCode) {
        setTimeout(focusCodeInput, 80);
    }

    if (unlocked && readDirect) {
        setTimeout(() => {
            applyReaderMode("original");
            document.getElementById("reader").scrollIntoView({ behavior: "auto", block: "start" });
        }, 50);
    }

}

document.addEventListener("DOMContentLoaded", async () => {
    if (typeof window.loadBookRegistry === "function") {
        try {
            await window.loadBookRegistry();
        } catch (error) {
            console.error(error);
        }
    }

    const page = document.body.dataset.page;
    if (page === "viewer") {
        renderViewerPage();
    }
    if (page === "intro") {
        renderIntroPage();
    }
    if (page === "library") {
        renderLibraryPage();
    }
    if (page === "reader") {
        renderReaderPage();
    }
});

window.__jnoteAccessDebug = {
    readAccessMap,
    grantAccess,
    revokeAccess,
    hasAccess
};
