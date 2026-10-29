package com.dayfeel.identity.common;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {
  private final ErrorWriter errors;

  public GlobalExceptionHandler(ErrorWriter errors) {
    this.errors = errors;
  }

  @ExceptionHandler(DomainException.class)
  public ResponseEntity<ApiError> domain(DomainException e, HttpServletRequest r) {
    return response(r, e.status(), e.code(), e.getMessage());
  }

  @ExceptionHandler({
    MethodArgumentNotValidException.class,
    HttpMessageNotReadableException.class,
    MethodArgumentTypeMismatchException.class,
    jakarta.validation.ConstraintViolationException.class
  })
  public ResponseEntity<ApiError> invalid(Exception e, HttpServletRequest r) {
    return response(r, 400, "VALIDATION_FAILED", "Request validation failed");
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  public ResponseEntity<ApiError> conflict(Exception e, HttpServletRequest r) {
    return response(r, 409, "CONFLICT", "Resource conflicts with existing data");
  }

  @ExceptionHandler(NoResourceFoundException.class)
  public ResponseEntity<ApiError> missing(Exception e, HttpServletRequest r) {
    return response(r, 404, "NOT_FOUND", "Resource not found");
  }

  @ExceptionHandler(org.springframework.web.HttpRequestMethodNotSupportedException.class)
  public ResponseEntity<ApiError> method(Exception e, HttpServletRequest r) {
    return response(r, 405, "METHOD_NOT_ALLOWED", "Method not allowed");
  }

  @ExceptionHandler(org.springframework.web.HttpMediaTypeNotSupportedException.class)
  public ResponseEntity<ApiError> media(Exception e, HttpServletRequest r) {
    return response(r, 415, "UNSUPPORTED_MEDIA_TYPE", "Unsupported media type");
  }

  @ExceptionHandler(org.springframework.web.bind.MissingServletRequestParameterException.class)
  public ResponseEntity<ApiError> parameter(Exception e, HttpServletRequest r) {
    return response(r, 400, "VALIDATION_FAILED", "Request validation failed");
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiError> unexpected(Exception e, HttpServletRequest r) {
    return response(r, 500, "INTERNAL_ERROR", "An unexpected error occurred");
  }

  private ResponseEntity<ApiError> response(HttpServletRequest r, int s, String c, String m) {
    return ResponseEntity.status(s).body(errors.body(r, s, c, m));
  }
}
