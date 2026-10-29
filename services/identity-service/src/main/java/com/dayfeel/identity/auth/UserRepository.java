package com.dayfeel.identity.auth;

import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID> {
  Optional<User> findByEmail(String email);

  boolean existsByEmail(String email);

  boolean existsByAlias(String alias);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select u from User u where u.id=:id")
  Optional<User> lockById(@Param("id") UUID id);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select u from User u where u.email=:email")
  Optional<User> lockByEmail(@Param("email") String email);
}
