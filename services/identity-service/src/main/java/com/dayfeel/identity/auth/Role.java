package com.dayfeel.identity.auth;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "roles")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Role {
  @Id private String name;

  public Role(String name) {
    this.name = name;
  }
}
