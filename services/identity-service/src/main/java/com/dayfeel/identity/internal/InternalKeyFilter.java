package com.dayfeel.identity.internal;

import com.dayfeel.identity.common.ErrorWriter;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.web.filter.OncePerRequestFilter;

public class InternalKeyFilter extends OncePerRequestFilter {
  private final String key;
  private final ErrorWriter errors;

  public InternalKeyFilter(String key, ErrorWriter errors) {
    this.key = key;
    this.errors = errors;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest r) {
    return !(r.getServletPath().equals("/internal") || r.getServletPath().startsWith("/internal/"));
  }

  @Override
  protected void doFilterInternal(HttpServletRequest r, HttpServletResponse s, FilterChain chain)
      throws ServletException, IOException {
    String supplied = r.getHeader("X-Internal-Key");
    if (key == null
        || key.isBlank()
        || supplied == null
        || !MessageDigest.isEqual(
            key.getBytes(StandardCharsets.UTF_8), supplied.getBytes(StandardCharsets.UTF_8))) {
      errors.write(r, s, 401, "INTERNAL_AUTH_REQUIRED", "Internal authentication required");
      return;
    }
    chain.doFilter(r, s);
  }
}
