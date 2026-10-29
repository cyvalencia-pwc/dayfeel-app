package com.dayfeel.identity.auth;

import com.dayfeel.identity.common.ErrorWriter;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class JwtFilter extends OncePerRequestFilter {
  private final JwtService jwt;
  private final UserRepository users;
  private final ErrorWriter errors;

  public JwtFilter(JwtService jwt, UserRepository users, ErrorWriter errors) {
    this.jwt = jwt;
    this.users = users;
    this.errors = errors;
  }

  @Override
  protected void doFilterInternal(HttpServletRequest r, HttpServletResponse s, FilterChain chain)
      throws ServletException, IOException {
    String auth = r.getHeader("Authorization");
    if (auth != null) {
      try {
        if (!auth.startsWith("Bearer ")) throw new IllegalArgumentException();
        var c = jwt.verify(auth.substring(7));
        var u = users.findById(UUID.fromString(c.getSubject())).orElseThrow();
        if (u.getStatus() != User.Status.ACTIVE || u.getTokenVersion() != c.get("ver", Long.class))
          throw new IllegalArgumentException();
        var authorities =
            u.getRoles().stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role.getName()))
                .toList();
        SecurityContextHolder.getContext()
            .setAuthentication(
                new UsernamePasswordAuthenticationToken(u.getId().toString(), null, authorities));
      } catch (io.jsonwebtoken.JwtException | IllegalArgumentException | NoSuchElementException e) {
        SecurityContextHolder.clearContext();
        errors.write(r, s, 401, "UNAUTHORIZED", "Authentication required");
        return;
      } catch (RuntimeException e) {
        SecurityContextHolder.clearContext();
        errors.write(r, s, 500, "INTERNAL_ERROR", "An unexpected error occurred");
        return;
      }
    }
    chain.doFilter(r, s);
  }
}
