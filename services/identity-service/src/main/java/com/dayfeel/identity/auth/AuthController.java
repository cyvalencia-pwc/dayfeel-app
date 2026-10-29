package com.dayfeel.identity.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.Principal;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
public class AuthController {
  private final AuthService auth;
  private final JwtService jwt;

  public AuthController(AuthService auth, JwtService jwt) {
    this.auth = auth;
    this.jwt = jwt;
  }

  public record Credentials(
      @NotBlank @Email @Size(max = 254) String email,
      @NotBlank @Size(min = 12, max = 72) String password) {}

  public record Refresh(@NotBlank @Size(max = 128) String refreshToken) {}

  @PostMapping("/auth/register")
  @ResponseStatus(HttpStatus.CREATED)
  public AuthService.Tokens register(@Valid @RequestBody Credentials r) {
    return auth.register(r.email(), r.password());
  }

  @PostMapping("/auth/login")
  public AuthService.Tokens login(@Valid @RequestBody Credentials r) {
    return auth.login(r.email(), r.password());
  }

  @PostMapping("/auth/refresh")
  public AuthService.Tokens refresh(@Valid @RequestBody Refresh r) {
    return auth.refresh(r.refreshToken());
  }

  @PostMapping("/auth/logout")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void logout(Principal principal) {
    auth.logout(UUID.fromString(principal.getName()));
  }

  @GetMapping("/.well-known/jwks.json")
  public Map<String, Object> jwks() {
    return jwt.jwks();
  }
}
