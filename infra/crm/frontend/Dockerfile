ARG EVO_VERSION
FROM evoapicloud/evo-ai-frontend-community:${EVO_VERSION}
COPY sso.html /usr/share/nginx/html/sso.html
COPY entrypoint-ra-connect.sh /entrypoint-ra-connect.sh
RUN sed -i 's/\r$//' /entrypoint-ra-connect.sh && chmod +x /entrypoint-ra-connect.sh
ENTRYPOINT ["/entrypoint-ra-connect.sh"]
CMD ["nginx", "-g", "daemon off;"]
