package com.dayfeel.identity.community;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.*;

@Entity
@Table(name = "circles")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Circle {
  @Id
  @org.hibernate.annotations.JdbcTypeCode(java.sql.Types.CHAR)
  private UUID id;

  private String name;

  @org.hibernate.annotations.JdbcTypeCode(java.sql.Types.CHAR)
  private UUID ownerId;

  public Circle(UUID id, String name, UUID ownerId) {
    this.id = id;
    this.name = name;
    this.ownerId = ownerId;
  }
}
