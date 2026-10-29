package com.dayfeel.identity.internal;

import com.dayfeel.identity.auth.*;
import com.dayfeel.identity.common.*;
import com.dayfeel.identity.community.*;
import com.dayfeel.identity.privacy.*;
import com.dayfeel.identity.profile.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/internal")
public class InternalController {
  private final CommunityService community;
  private final ProfileService profiles;
  private final UserRepository users;
  private final com.dayfeel.identity.privacy.IdentityExportService exports;

  public InternalController(
      CommunityService community,
      ProfileService profiles,
      UserRepository users,
      com.dayfeel.identity.privacy.IdentityExportService exports) {
    this.community = community;
    this.profiles = profiles;
    this.users = users;
    this.exports = exports;
  }

  public record Aliases(@NotEmpty @Size(max = 100) List<@NotNull UUID> userIds) {}

  @GetMapping("/circles/{circle}/users/{user}/restrictions")
  public CommunityService.Restriction restrictions(
      @PathVariable UUID circle, @PathVariable UUID user) {
    return community.restrictions(circle, user);
  }

  @GetMapping("/circles/{circle}/users/{user}/membership")
  public CommunityService.MemberView membership(
      @PathVariable UUID circle, @PathVariable UUID user) {
    return community.membership(circle, user);
  }

  @GetMapping("/users/{user}/consent")
  public ProfileService.Consent consent(@PathVariable UUID user) {
    return profiles.get(user).consent();
  }

  @PostMapping("/aliases")
  public Map<UUID, String> aliases(@Valid @RequestBody Aliases r) {
    var result = new HashMap<UUID, String>();
    users.findAllById(r.userIds()).forEach(u -> result.put(u.getId(), u.getAlias()));
    return result;
  }

  public record AiReport(
      @NotNull UUID targetId,
      @NotNull UUID circleId,
      @NotBlank @Size(max = 100) String contentId,
      @NotNull Report.Reason reason,
      @NotBlank @Pattern(regexp = "AI") String source) {}

  @PostMapping("/reports")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, UUID> aiReport(@Valid @RequestBody AiReport r) {
    // A null reporter is the existing representation of an automated report.
    return Map.of(
        "id", community.report(null, r.targetId(), r.circleId(), r.contentId(), r.reason()));
  }

  @GetMapping("/users/{user}/export-data")
  public com.dayfeel.identity.privacy.IdentityExportService.Data exportData(
      @PathVariable UUID user) {
    return exports.export(user);
  }
}
