package com.dayfeel.identity.community;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.Principal;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
public class CommunityController {
  private final CommunityService service;

  public CommunityController(CommunityService service) {
    this.service = service;
  }

  public record CreateCircle(@NotBlank @Size(max = 100) String name) {}

  public record ReportInput(
      @NotNull UUID targetId,
      @NotNull UUID circleId,
      @Size(max = 100) String contentId,
      @NotNull Report.Reason reason) {}

  public record Moderate(
      @NotNull UUID targetId,
      @NotNull CommunityService.Action action,
      Instant until,
      @Size(max = 100) String contentId) {}

  @GetMapping("/circles")
  public List<CommunityService.CircleView> list(
      Principal principal, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
    return service.list(id(principal), page, size);
  }

  @PostMapping("/circles")
  @ResponseStatus(HttpStatus.CREATED)
  public CommunityService.CircleView create(Principal p, @Valid @RequestBody CreateCircle r) {
    return service.create(id(p), r.name());
  }

  @PostMapping("/circles/{circle}/members/me")
  public CommunityService.MemberView join(Principal p, @PathVariable UUID circle) {
    return service.join(id(p), circle);
  }

  @DeleteMapping("/circles/{circle}/members/me")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void leave(Principal p, @PathVariable UUID circle) {
    service.leave(id(p), circle);
  }

  @PutMapping("/circles/{circle}/moderators/{target}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void promote(Principal p, @PathVariable UUID circle, @PathVariable UUID target) {
    service.promote(id(p), circle, target);
  }

  @PostMapping("/reports")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, UUID> report(Principal p, @Valid @RequestBody ReportInput r) {
    return Map.of(
        "id", service.report(id(p), r.targetId(), r.circleId(), r.contentId(), r.reason()));
  }

  @PostMapping("/circles/{circle}/moderation")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void moderate(Principal p, @PathVariable UUID circle, @Valid @RequestBody Moderate r) {
    service.moderate(id(p), r.targetId(), circle, r.action(), r.until(), r.contentId());
  }

  private UUID id(Principal p) {
    return UUID.fromString(p.getName());
  }

  @GetMapping("/circles/{circle}/reports")
  public List<CommunityService.ReportView> reports(
      Principal p, @PathVariable UUID circle, @RequestParam(defaultValue = "0") int page) {
    return service.reportQueue(id(p), circle, page);
  }

  @GetMapping("/reports/{report}")
  public CommunityService.ReportView reportDetail(Principal p, @PathVariable UUID report) {
    return service.reportDetail(id(p), report);
  }
}
