package org.springframework.samples.petclinic.rest;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.CrossOrigin;
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

}
