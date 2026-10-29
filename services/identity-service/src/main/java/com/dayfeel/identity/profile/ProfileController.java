package com.dayfeel.identity.profile;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.Principal;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/me")
public class ProfileController {
  private final ProfileService service;

  public ProfileController(ProfileService service) {
    this.service = service;
  }

  public record Alias(@NotBlank @Pattern(regexp = "[A-Za-z][A-Za-z0-9]{2,39}") String alias) {}

  public record Avatar(@NotBlank String contentType, @Min(1) @Max(5242880) long size) {}

  public record Onboarding(@NotNull @AssertTrue Boolean acknowledged) {}

  @GetMapping("/session")
  public ProfileService.Session session(Principal p) {
    return service.session(id(p));
  }

  @PostMapping("/onboarding")
  @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
  public void onboarding(Principal p, @Valid @RequestBody Onboarding input) {
    service.completeOnboarding(id(p));
  }

  @GetMapping
  public ProfileService.Profile get(Principal p) {
    return service.get(id(p));
  }

  @PatchMapping
  public ProfileService.Profile alias(Principal p, @Valid @RequestBody Alias r) {
    return service.alias(id(p), r.alias());
  }

  @GetMapping("/consent")
  public ProfileService.Consent consent(Principal p) {
    return service.get(id(p)).consent();
  }

  @PutMapping("/consent")
  public ProfileService.Consent consent(Principal p, @RequestBody ProfileService.Consent r) {
    return service.consent(id(p), r);
  }

  @PostMapping("/avatar-upload")
  public StorageService.Upload avatar(Principal p, @Valid @RequestBody Avatar r) {
    return service.avatar(id(p), r.contentType(), r.size());
  }

  private UUID id(Principal p) {
    return UUID.fromString(p.getName());
  }
}
