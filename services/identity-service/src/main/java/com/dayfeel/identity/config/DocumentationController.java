package com.dayfeel.identity.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class DocumentationController {
  @GetMapping({"/docs", "/docs/", "/swagger-ui", "/swagger-ui/", "/swagger-ui.html"})
  public String documentation() {
    return "redirect:/swagger-ui/index.html";
  }
}
