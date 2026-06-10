package victor.training.petclinic.rest;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

@RestController
@RequestMapping("/")
public class RootRestController {

    @Value("#{servletContext.contextPath}")
    private String servletContextPath;

	@RequestMapping("/")
	public void redirectToSwagger(HttpServletResponse response) throws IOException {
		response.sendRedirect(servletContextPath + "/swagger-ui/index.html");
	}

    // --- Artificial code smell to validate the customized SonarCloud rule java:S107 ---
    // The "petclinic agentic (extend)" quality profile lowers S107's `max` parameters from 7 to 5.
    // This method has 6 parameters, so the custom profile flags it while the default (max 7) would
    // NOT. Temporary: remove after confirming the rule fires on SonarCloud.
    public String describePet(String name, String type, int age, double weight,
                              String ownerName, String city) {
        return name + " (" + type + "), age " + age + ", " + weight + "kg — owner "
            + ownerName + " from " + city;
    }

}
