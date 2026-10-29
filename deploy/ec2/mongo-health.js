try {
  const status = rs.status();
  quit(status.myState === 1 ? 0 : 1);
} catch (error) {
  if (error.code === 94 || error.codeName === 'NotYetInitialized') {
    rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'mongo:27017'}]});
    quit(1); // Wait for election before allowing content-service to start.
  }
  throw error;
}
