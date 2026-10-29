package com.dayfeel.identity.auth;

import com.dayfeel.identity.common.ErrorWriter;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.password.*;
import org.springframework.security.web.*;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfiguration {
  @Bean
  PasswordEncoder passwordEncoder() {
    return new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(12);
  }

  @Bean
  SecurityFilterChain security(
      HttpSecurity http,
      JwtService jwt,
      UserRepository users,
      ErrorWriter errors,
      com.dayfeel.identity.config.DayfeelProperties properties)
      throws Exception {
    return http.csrf(c -> c.disable())
        .sessionManagement(c -> c.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            a ->
                a.requestMatchers(
                        "/auth/register",
                        "/auth/login",
                        "/auth/refresh",
                        "/.well-known/jwks.json",
                        "/actuator/health",
                        "/docs",
                        "/docs/",
                        "/swagger-ui.html",
                        "/swagger-ui/**")
                    .permitAll()
                    .requestMatchers("/internal/**")
                    .permitAll()
                    .requestMatchers("/admin/**")
                    .hasRole("ADMIN")
                    .anyRequest()
                    .authenticated())
        .exceptionHandling(
            e ->
                e.authenticationEntryPoint(
                        (r, s, x) ->
                            errors.write(r, s, 401, "UNAUTHORIZED", "Authentication required"))
                    .accessDeniedHandler(
                        (r, s, x) ->
                            errors.write(r, s, 403, "FORBIDDEN", "This action is not permitted")))
        .addFilterBefore(
            new com.dayfeel.identity.internal.InternalKeyFilter(properties.internalKey(), errors),
            UsernamePasswordAuthenticationFilter.class)
        .addFilterBefore(
            new JwtFilter(jwt, users, errors), UsernamePasswordAuthenticationFilter.class)
        .build();
  }
}
