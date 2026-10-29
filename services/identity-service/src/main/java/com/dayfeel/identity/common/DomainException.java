package com.dayfeel.identity.common;

public class DomainException extends RuntimeException {
  private final int status;
  private final String code;

  public DomainException(int status, String code, String message) {
    super(message);
    this.status = status;
    this.code = code;
  }

  public int status() {
    return status;
  }

  public String code() {
    return code;
  }

  public static DomainException missing() {
    return new DomainException(404, "NOT_FOUND", "Resource not found");
  }

  public static DomainException forbidden() {
    return new DomainException(403, "FORBIDDEN", "This action is not permitted");
  }

  public static DomainException unauthorized() {
    return new DomainException(401, "UNAUTHORIZED", "Authentication required");
  }
}
