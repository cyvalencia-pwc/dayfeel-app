package com.dayfeel.identity;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.dayfeel.identity.config.DocumentationController;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class DocumentationTest {
  @Test
  void documentationRedirectsAndContractIsPackaged() throws Exception {
    var mvc = MockMvcBuilders.standaloneSetup(new DocumentationController()).build();
    mvc.perform(get("/docs"))
        .andExpect(status().is3xxRedirection())
        .andExpect(redirectedUrl("/swagger-ui/index.html"));
    try (var stream = new ClassPathResource("static/swagger-ui/openapi.json").getInputStream()) {
      var spec = new ObjectMapper().readTree(stream);
      assertEquals("/", spec.path("servers").get(0).path("url").asText());
      assertTrue(spec.path("paths").has("/auth/login"));
      assertTrue(spec.path("components").path("securitySchemes").has("bearerAuth"));
    }
  }
}
