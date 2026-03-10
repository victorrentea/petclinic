package org.petclinic.qa.pages;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeoutException;

import org.openqa.selenium.By;
import org.openqa.selenium.Keys;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public class OwnersPage {

    private static final By PAGE_TITLE = By.xpath("//h2[normalize-space()='Owners']");
    private static final By LAST_NAME_INPUT = By.id("lastName");
    private static final By FIND_OWNER_BUTTON = By.cssSelector("#search-owner-form button[type='submit']");
    private static final By OWNER_NAME_CELLS = By.cssSelector("#ownersTable td.ownerFullName");

    private final WebDriver driver;
    private final WebDriverWait wait;

    public OwnersPage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    }

    public void open(String baseUrl) {
        driver.get(baseUrl + "/owners");
        wait.until(ExpectedConditions.visibilityOfElementLocated(PAGE_TITLE));
    }

    public List<String> ownerFullNames() {
        wait.until(ExpectedConditions.or(
            ExpectedConditions.visibilityOfElementLocated(OWNER_NAME_CELLS),
            ExpectedConditions.visibilityOfElementLocated(By.id("lastName"))
        ));

        return driver.findElements(OWNER_NAME_CELLS)
            .stream()
            .map(WebElement::getText)
            .map(String::trim)
            .filter(value -> !value.isBlank())
            .toList();
    }

    public void searchByLastNamePrefix(String prefix) {
        WebElement input = wait.until(ExpectedConditions.visibilityOfElementLocated(LAST_NAME_INPUT));
        input.clear();
        input.sendKeys(prefix);
        input.sendKeys(Keys.TAB);

        WebElement button = wait.until(ExpectedConditions.elementToBeClickable(FIND_OWNER_BUTTON));
        button.click();
    }

    public void waitForOwnersCount(int expectedCount) {
        try {
            wait.until(driver -> driver.findElements(OWNER_NAME_CELLS).size() == expectedCount);
        } catch (TimeoutException ignored) {
            // Let assertions fail with actual values when wait condition is not met.
        }
    }
}
