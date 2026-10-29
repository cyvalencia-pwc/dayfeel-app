package com.dayfeel.identity.common;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TraceIdFilter extends OncePerRequestFilter {
  public static final String ATTRIBUTE = "traceId";

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String incoming = request.getHeader("X-Trace-Id");
    String id =
        incoming != null && incoming.matches("[a-zA-Z0-9-]{1,64}")
            ? incoming
            : UUID.randomUUID().toString();
    request.setAttribute(ATTRIBUTE, id);
    response.setHeader("X-Trace-Id", id);
    try (MDC.MDCCloseable ignored = MDC.putCloseable(ATTRIBUTE, id)) {
      chain.doFilter(request, response);
    }
  }
}
