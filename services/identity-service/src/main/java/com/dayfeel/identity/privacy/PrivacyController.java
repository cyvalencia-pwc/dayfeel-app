package com.dayfeel.identity.privacy;

import java.security.Principal;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/me")
public class PrivacyController {
  private final PrivacyService service;

  public PrivacyController(PrivacyService service) {
    this.service = service;
  }

  @PostMapping("/exports")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public PrivacyService.View export(Principal p) {
    return service.request(UUID.fromString(p.getName()), PrivacyRequest.Kind.EXPORT);
  }

  @PostMapping("/deletion")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public PrivacyService.View delete(Principal p) {
    return service.request(UUID.fromString(p.getName()), PrivacyRequest.Kind.DELETION);
  }

  @GetMapping("/privacy-requests/{id}")
  public PrivacyService.View status(Principal p, @PathVariable UUID id) {
    return service.status(UUID.fromString(p.getName()), id);
  }
}
