package com.dayfeel.identity;

import static org.assertj.core.api.Assertions.*;

import com.dayfeel.identity.common.*;
import com.dayfeel.identity.config.CoreConfiguration;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.slf4j.MDC;
import org.springframework.mock.web.*;

class FoundationTest {
  final TestClock clock = new TestClock();
  final ErrorWriter errors = new ErrorWriter(clock, new ObjectMapper().findAndRegisterModules());

  @ParameterizedTest
  @ValueSource(strings = {"abc", "a-b-1", "0123"})
  void acceptsSafeTrace(String trace) throws Exception {
    var r = new MockHttpServletRequest();
    r.addHeader("X-Trace-Id", trace);
    var s = new MockHttpServletResponse();
    new TraceIdFilter().doFilter(r, s, (a, b) -> assertThat(MDC.get("traceId")).isEqualTo(trace));
    assertThat(s.getHeader("X-Trace-Id")).isEqualTo(trace);
    assertThat(MDC.get("traceId")).isNull();
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "",
        "a b",
        "bad\nvalue",
        "<script>",
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      })
  void replacesUnsafeTrace(String trace) throws Exception {
    var r = new MockHttpServletRequest();
    r.addHeader("X-Trace-Id", trace);
    var s = new MockHttpServletResponse();
    new TraceIdFilter().doFilter(r, s, (a, b) -> {});
    assertThat(s.getHeader("X-Trace-Id")).matches("[a-f0-9-]{36}");
  }

  @Test
  void cleansTraceOnFailure() {
    var r = new MockHttpServletRequest();
    var s = new MockHttpServletResponse();
    assertThatThrownBy(
            () ->
                new TraceIdFilter()
                    .doFilter(
                        r,
                        s,
                        (a, b) -> {
                          throw new RuntimeException();
                        }))
        .isInstanceOf(RuntimeException.class);
    assertThat(MDC.get("traceId")).isNull();
  }

  @Test
  void unexpectedErrorsAreSanitized() {
    var r = new MockHttpServletRequest("GET", "/test");
    r.setAttribute("traceId", "t");
    var body =
        new GlobalExceptionHandler(errors).unexpected(new RuntimeException("secret"), r).getBody();
    assertThat(body.message()).doesNotContain("secret");
    assertThat(body.status()).isEqualTo(500);
    assertThat(body.timestamp()).isEqualTo(clock.instant());
    assertThat(body.traceId()).isEqualTo("t");
  }

  @Test
  void domainErrorsKeepSafeCode() {
    var r = new MockHttpServletRequest();
    var body = new GlobalExceptionHandler(errors).domain(DomainException.forbidden(), r).getBody();
    assertThat(body.status()).isEqualTo(403);
    assertThat(body.code()).isEqualTo("FORBIDDEN");
  }

  @Test
  void writesJsonError() throws Exception {
    var s = new MockHttpServletResponse();
    errors.write(new MockHttpServletRequest(), s, 401, "UNAUTHORIZED", "Authentication required");
    assertThat(s.getStatus()).isEqualTo(401);
    assertThat(s.getContentType()).isEqualTo("application/json");
  }

  @Test
  void validationIsSanitized() {
    assertThat(
            new GlobalExceptionHandler(errors)
                .invalid(new RuntimeException("secret"), new MockHttpServletRequest())
                .getBody()
                .message())
        .doesNotContain("secret");
  }

  @Test
  void conflictIsSanitized() {
    assertThat(
            new GlobalExceptionHandler(errors)
                .conflict(new RuntimeException("secret"), new MockHttpServletRequest())
                .getStatusCode()
                .value())
        .isEqualTo(409);
  }

  @Test
  void missingIs404() {
    assertThat(
            new GlobalExceptionHandler(errors)
                .missing(new RuntimeException(), new MockHttpServletRequest())
                .getStatusCode()
                .value())
        .isEqualTo(404);
  }

  @Test
  void clockIsUtc() {
    assertThat(new CoreConfiguration().clock().getZone()).isEqualTo(java.time.ZoneOffset.UTC);
  }
}
