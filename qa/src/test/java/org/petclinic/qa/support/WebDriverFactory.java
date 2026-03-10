package org.petclinic.qa.support;

import java.time.Duration;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;

public final class WebDriverFactory {

    private WebDriverFactory() {
    }

    public static WebDriver createChrome() {
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--window-size=1920,1080");

        if (Boolean.parseBoolean(System.getProperty("headless", "true"))) {
            options.addArguments("--headless=new");
        }

        WebDriver driver = new ChromeDriver(options);
        driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(1));
        return driver;
    }
}
