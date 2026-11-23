ARG EVO_VERSION
FROM evoapicloud/evo-auth-service-community:${EVO_VERSION}
COPY --chown=1000:1000 ra_connect_sso_controller.rb /rails/app/controllers/ra_connect_sso_controller.rb
COPY --chown=1000:1000 ra_connect_sso.rb /rails/config/initializers/ra_connect_sso.rb
