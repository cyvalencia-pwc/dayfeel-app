package com.dayfeel.identity.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.time.Clock;
import org.springframework.stereotype.Component;

@Component
public class ErrorWriter {
  private final Clock clock;
  private final ObjectMapper mapper;

  public ErrorWriter(Clock clock, ObjectMapper mapper) {
    this.clock = clock;
    this.mapper = mapper;
  }

  public ApiError body(HttpServletRequest r, int status, String code, String message) {
    return new ApiError(
        clock.instant(),
        status,
        code,
        message,
        r.getRequestURI(),
        String.valueOf(r.getAttribute(TraceIdFilter.ATTRIBUTE)));
  }

  public void write(
      HttpServletRequest r, HttpServletResponse s, int status, String code, String message)
      throws IOException {
    s.setStatus(status);
    s.setContentType("application/json");
    mapper.writeValue(s.getOutputStream(), body(r, status, code, message));
  }
}
