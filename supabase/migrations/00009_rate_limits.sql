CREATE TABLE IF NOT EXISTS api_rate_limits (
  bucket_key   text        NOT NULL,
  window_start timestamptz NOT NULL,
  request_count int         NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);

CREATE OR REPLACE FUNCTION check_rate_limit(p_key text, p_max int, p_window_seconds int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count  int;
BEGIN
  DELETE FROM api_rate_limits WHERE bucket_key = p_key AND window_start < v_window;
  INSERT INTO api_rate_limits (bucket_key, window_start, request_count)
  VALUES (p_key, v_window, 1)
  ON CONFLICT (bucket_key, window_start)
  DO UPDATE SET request_count = api_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;
  RETURN v_count <= p_max;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM api_rate_limits WHERE window_start < now() - interval '1 day';
$$;
