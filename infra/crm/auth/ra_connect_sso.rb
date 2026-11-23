# Rota da ponte de login do RA Connect (prepend: antes das rotas do próprio Evo).
Rails.application.routes.prepend do
  post '/api/v1/sso/ra-connect', to: 'ra_connect_sso#create'
end
