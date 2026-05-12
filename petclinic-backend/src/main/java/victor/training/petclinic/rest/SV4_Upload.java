package victor.training.petclinic.rest;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.util.concurrent.CompletableFuture;

/**
 * Exercise SV4 -- File Upload Vulnerabilities -- 4 Waves
 * Wave 1: Path traversal -- user-controlled filename escapes the upload folder
 * Wave 2: Shell injection -- filename concatenated into a shell command = RCE
 * Wave 3: Memory exhaustion -- byte[] in unbounded async queue = OOM under load
 * Wave 4: Proper file handling -- temp files, UUID names, bounded executor, cleanup
 */
@Slf4j
@RestController
public class SV4_Upload {

  public static final File IN_FOLDER = new File("in/");

  @PostMapping("api/vulnerability/upload")
  public String upload(@RequestParam String fileName, @RequestParam MultipartFile file) throws IOException {
    log.debug("Uploading file name={} size={}", fileName, file.getSize());
    byte[] content = file.getBytes();
    CompletableFuture.runAsync(() -> processFile(content, fileName));
    return "DONE";
  }

  /** Slow file processing task */
  private void processFile(byte[] content, String fileName) {
    File targetFile = new File(IN_FOLDER, fileName);
    try {
      Runtime.getRuntime().exec(new String[]{"/bin/sh", "-c", "touch " + targetFile.getAbsolutePath()});
    } catch (IOException e) {
      log.trace("Error", e);
    }
    log.info("Processing file: {} ({} bytes)", fileName, content.length);

    try {
      Thread.sleep(60_000); // simulate minutes of processing
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
    log.info("Done processing file: {}", fileName);
  }

  @GetMapping("api/vulnerability/vulnerable-file-name")
  public String getVulnerableFileNameForDemo() {
    return IN_FOLDER.toPath()
            .relativize(new File("pom.xml").toPath()).toString();
  }

  @PostConstruct
  public void createInFolder() {
    IN_FOLDER.mkdir();
    if (!IN_FOLDER.isDirectory()) {
      throw new IllegalArgumentException("Should be a directory: " + IN_FOLDER.getAbsolutePath());
    }
  }
}
