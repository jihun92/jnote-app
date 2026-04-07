const { test, expect } = require("@playwright/test");

const BOOK_ID = "resume-master-book";
const BOOK_URL = `/book.html?book=${BOOK_ID}`;
const BOOK_READ_URL = `/book.html?book=${BOOK_ID}&read=1`;
const BOOK_PREVIEW_URL = `/book.html?book=${BOOK_ID}&preview=1`;
const INTRO_URL = `/book-intro.html?book=${BOOK_ID}`;
const ACCESS_KEY = "jnote-library-access";
const DEMO_CODE = "JNOTE-OPEN-2026";

test.describe("JNOTE ebook flow", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await page.evaluate((storageKey) => localStorage.removeItem(storageKey), ACCESS_KEY);
    });

    test("root redirects to intro page", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveURL(new RegExp(`${INTRO_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
        await expect(page.locator("h1")).toContainText("화려한 기술 스택보다 중요한 건");
    });

    test("library shows representative book and intro link", async ({ page }) => {
        await page.goto("/library.html");
        await expect(page.locator("h2")).toContainText("전자책 책장");
        const card = page.locator(".book-card").first();
        await expect(card).toContainText("비전공자 역전 이력서 합격 문장 공식");
        await expect(card.getByRole("link", { name: "전자책 소개" })).toHaveAttribute("href", `./book-intro.html?book=${BOOK_ID}`);
    });

    test("preview flow unlocks, persists, and can be reset", async ({ page }) => {
        await page.goto(BOOK_PREVIEW_URL);

        await expect(page.locator("#readerStatusText")).toContainText("샘플 미리보기만 열려 있습니다.");
        await expect(page.locator("#previewReader")).toBeVisible();
        await expect(page.locator("#unlockedSection")).toBeHidden();

        await page.fill("#accessCodeInput", DEMO_CODE);
        await page.click("#submitCodeButton");

        await expect(page.locator("#readerStatusText")).toContainText("전체 원고가 열려 있습니다.");
        await expect(page.locator("#previewReader")).toBeHidden();
        await expect(page.locator("#unlockedSection")).toBeVisible();
        await expect(page.locator("#submitCodeButton")).toBeDisabled();
        await expect(page.locator("#focusCodeButton")).toBeDisabled();
        await expect(page.locator("#floatingPurchaseButton")).toBeHidden();
        await expect(page.locator("#savedAccessNote")).toContainText("이 브라우저에 열람 권한이 저장되어 있습니다.");

        await page.reload();
        await expect(page.locator("#readerStatusText")).toContainText("전체 원고가 열려 있습니다.");
        await expect(page.locator("#previewReader")).toBeHidden();

        await page.click("#resetAccessButton");
        await expect(page.locator("#readerStatusText")).toContainText("샘플 미리보기만 열려 있습니다.");
        await expect(page.locator("#previewReader")).toBeVisible();
        await expect(page.locator("#submitCodeButton")).toBeEnabled();
        await expect(page.locator("#focusCodeButton")).toBeEnabled();
    });

    test("authenticated preview URL redirects to full read URL", async ({ page }) => {
        await page.goto(BOOK_URL);
        await page.evaluate(
            ([storageKey, bookId]) => {
                localStorage.setItem(
                    storageKey,
                    JSON.stringify({
                        [bookId]: {
                            active: true,
                            unlockedAt: new Date().toISOString(),
                            watermarkToken: "2026"
                        }
                    })
                );
            },
            [ACCESS_KEY, BOOK_ID]
        );

        await page.goto(BOOK_PREVIEW_URL);
        await expect(page).toHaveURL(new RegExp(`${BOOK_READ_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
        await expect(page.locator("#readerStatusText")).toContainText("전체 원고가 열려 있습니다.");
    });

    test("legacy viewer URL redirects to unified read page", async ({ page }) => {
        await page.goto("/viewer.html?book=resume-master-book");
        await expect(page).toHaveURL(new RegExp(`${BOOK_READ_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    });
});
