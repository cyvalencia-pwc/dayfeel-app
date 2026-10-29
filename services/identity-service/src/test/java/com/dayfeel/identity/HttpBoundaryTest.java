package com.dayfeel.identity;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.dayfeel.identity.auth.*;
import com.dayfeel.identity.common.*;
import com.dayfeel.identity.profile.*;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@ExtendWith(MockitoExtension.class)
class HttpBoundaryTest {
  @Mock AuthService auth;
  @Mock JwtService jwt;
  @Mock ProfileService profiles;
  @Mock com.dayfeel.identity.community.CommunityService community;
  MockMvc mvc;

  @BeforeEach
  void setup() {
    var mapper =
        new ObjectMapper()
            .findAndRegisterModules()
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
    mvc =
        MockMvcBuilders.standaloneSetup(
                new AuthController(auth, jwt),
                new ProfileController(profiles),
                new com.dayfeel.identity.internal.InternalController(
                    community, profiles, null, null))
            .setControllerAdvice(
                new GlobalExceptionHandler(new ErrorWriter(new TestClock(), mapper)))
            .setMessageConverters(new MappingJackson2HttpMessageConverter(mapper))
            .addFilters(new TraceIdFilter())
            .build();
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "not-json",
        "{}",
        "{\"email\":\"bad\",\"password\":\"short\"}",
        "{\"email\":\"a@example.com\",\"password\":\"validpassword\",\"journalText\":\"private\"}"
      })
  void invalidAuthInputRejected(String body) throws Exception {
    mvc.perform(post("/auth/register").contentType("application/json").content(body))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(jsonPath("$.traceId").exists());
    verifyNoInteractions(auth);
  }

  @Test
  void registrationReturnsCreated() throws Exception {
    when(auth.register("a@example.com", "validpassword"))
        .thenReturn(new AuthService.Tokens("a", "r", "Bearer", 900));
    mvc.perform(
            post("/auth/register")
                .contentType("application/json")
                .content("{\"email\":\"a@example.com\",\"password\":\"validpassword\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.accessToken").value("a"));
  }

  @Test
  void unexpectedErrorsNeverLeak() throws Exception {
    when(auth.login(any(), any())).thenThrow(new IllegalStateException("database password"));
    mvc.perform(
            post("/auth/login")
                .contentType("application/json")
                .content("{\"email\":\"a@example.com\",\"password\":\"validpassword\"}"))
        .andExpect(status().isInternalServerError())
        .andExpect(jsonPath("$.message").value("An unexpected error occurred"));
  }

  @Test
  void wrongMethodStandardError() throws Exception {
    mvc.perform(get("/auth/login"))
        .andExpect(status().isMethodNotAllowed())
        .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
  }

  @Test
  void wrongContentTypeStandardError() throws Exception {
    mvc.perform(post("/auth/login").contentType("text/plain").content("hello"))
        .andExpect(status().isUnsupportedMediaType())
        .andExpect(jsonPath("$.traceId").exists());
  }

  @Test
  void aiReportUsesMachineReporter() throws Exception {
    var user = java.util.UUID.randomUUID();
    var circle = java.util.UUID.randomUUID();
    var report = java.util.UUID.randomUUID();
    when(community.report(
            null, user, circle, "abc123", com.dayfeel.identity.community.Report.Reason.UNSAFE))
        .thenReturn(report);
    mvc.perform(
            post("/internal/reports")
                .contentType("application/json")
                .content(
                    "{\"targetId\":\""
                        + user
                        + "\",\"circleId\":\""
                        + circle
                        + "\",\"contentId\":\"abc123\",\"reason\":\"UNSAFE\",\"source\":\"AI\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value(report.toString()));
    verify(community)
        .report(null, user, circle, "abc123", com.dayfeel.identity.community.Report.Reason.UNSAFE);
  }

  @Test
  void aiReportRejectsNonAiSource() throws Exception {
    mvc.perform(
            post("/internal/reports")
                .contentType("application/json")
                .content(
                    "{\"targetId\":\""
                        + java.util.UUID.randomUUID()
                        + "\",\"circleId\":\""
                        + java.util.UUID.randomUUID()
                        + "\",\"contentId\":\"abc123\",\"reason\":\"UNSAFE\",\"source\":\"USER\"}"))
        .andExpect(status().isBadRequest());
    verifyNoInteractions(community);
  }

  @Test
  void consentOmissionsDefaultOff() throws Exception {
    var id = java.util.UUID.randomUUID();
    when(profiles.consent(eq(id), any())).thenAnswer(i -> i.getArgument(1));
    mvc.perform(
            put("/me/consent")
                .principal(() -> id.toString())
                .contentType("application/json")
                .content("{}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.aiAnalysis").doesNotExist())
        .andExpect(jsonPath("$.companionMemory").value(false))
        .andExpect(jsonPath("$.analytics").doesNotExist());
  }

  @ParameterizedTest
  @ValueSource(strings = {"{}", "{\"acknowledged\":false}"})
  void onboardingRequiresAcknowledgement(String body) throws Exception {
    mvc.perform(
            post("/me/onboarding")
                .principal(() -> java.util.UUID.randomUUID().toString())
                .contentType("application/json")
                .content(body))
        .andExpect(status().isBadRequest());
    verify(profiles, never()).completeOnboarding(any());
  }
}
