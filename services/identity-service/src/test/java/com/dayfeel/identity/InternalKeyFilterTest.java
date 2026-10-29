package com.dayfeel.identity;

import static org.assertj.core.api.Assertions.*;

import com.dayfeel.identity.common.ErrorWriter;
import com.dayfeel.identity.internal.InternalKeyFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.springframework.mock.web.*;

class InternalKeyFilterTest {
  final ErrorWriter errors =
      new ErrorWriter(new TestClock(), new ObjectMapper().findAndRegisterModules());

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {" ", "\t"})
  void blankConfigurationRejectsEveryRequest(String key) throws Exception {
    check(key, "anything", false);
  }

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {"wrong", "secret ", "SECRET"})
  void invalidHeaderRejected(String supplied) throws Exception {
    check("secret", supplied, false);
  }

  @Test
  void validHeaderAllowed() throws Exception {
    check("secret", "secret", true);
  }

  @Test
  void publicPathsUnaffected() throws Exception {
    var r = new MockHttpServletRequest();
    r.setServletPath("/auth/login");
    var called = new AtomicBoolean();
    new InternalKeyFilter("", errors)
        .doFilter(r, new MockHttpServletResponse(), (a, b) -> called.set(true));
    assertThat(called).isTrue();
  }

  void check(String key, String supplied, boolean allowed) throws Exception {
    var r = new MockHttpServletRequest();
    r.setServletPath("/internal/aliases");
    if (supplied != null) r.addHeader("X-Internal-Key", supplied);
    var s = new MockHttpServletResponse();
    var called = new AtomicBoolean();
    new InternalKeyFilter(key, errors).doFilter(r, s, (a, b) -> called.set(true));
    assertThat(called.get()).isEqualTo(allowed);
    if (!allowed) {
      assertThat(s.getStatus()).isEqualTo(401);
      assertThat(s.getContentAsString()).contains("traceId").doesNotContain("secret");
    }
  }
}
