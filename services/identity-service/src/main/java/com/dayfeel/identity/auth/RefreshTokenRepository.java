package com.dayfeel.identity.auth;

import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, String> {
  @Override
  @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
  Optional<RefreshToken> findById(String hash);

  @Modifying
  @Query("update RefreshToken t set t.revoked=true where t.userId=:userId")
  int revokeAll(@Param("userId") UUID userId);

  @Query("select t.userId from RefreshToken t where t.hash=:hash")
  Optional<UUID> ownerOf(@Param("hash") String hash);
}
