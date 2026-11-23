# Emite um token do CRM para um usuário já autenticado no RA Connect.
# Só o servidor do RA Connect (Vercel) chama, com o segredo RA_CONNECT_SSO_TOKEN.
class RaConnectSsoController < ActionController::API
  include AuthHelper

  def create
    esperado = ENV['RA_CONNECT_SSO_TOKEN'].to_s
    recebido = request.headers['X-RA-Connect-Token'].to_s
    if esperado.length < 32 || !ActiveSupport::SecurityUtils.secure_compare(esperado, recebido)
      return render json: { erro: 'nao_autorizado' }, status: :unauthorized
    end

    user = User.from_email(params[:email].to_s.strip.downcase)
    return render json: { erro: 'usuario_nao_cadastrado_no_crm' }, status: :not_found unless user

    token = create_oauth_token(user)
    render json: { access_token: token.token, expires_in: token.expires_in }
  end
end
