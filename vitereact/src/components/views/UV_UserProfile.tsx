   const currentUser = useAppStore(state =>
state.authentication_state.current_user);
   const authToken = useAppStore(state => state.authentication_state.auth_token);
   const updateCurrentUser = useAppStore(state => state.update_current_user);
   const logout = useAppStore(state => state.logout);