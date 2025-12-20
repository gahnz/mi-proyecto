import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../supabase/client";

export default function ProtectedRoute({ children, requiredRole }) {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState(null);

    useEffect(() => {
        // 1. Check current session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) {
                fetchUserRole(session.user.id);
            } else {
                setLoading(false);
            }
        });

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) {
                fetchUserRole(session.user.id);
            } else {
                setUserRole(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    async function fetchUserRole(userId) {
        try {
            // We assume there is a 'profiles' table with a 'role' column
            const { data, error } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", userId)
                .single();

            if (error) throw error;
            setUserRole(data?.role);
        } catch (err) {
            console.error("Error fetching role:", err);
            setUserRole("user"); // Default role if not found
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-brand-purple border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!session) {
        // Redirect to the appropriate login page based on the required role
        return <Navigate to={requiredRole === "technician" ? "/login-tecnico" : "/login"} replace />;
    }

    // Jerarquía de roles: admin (2) > coordinador (1) > tecnico (0)
    const roles = ["tecnico", "coordinador", "admin"];
    const currentRoleIndex = roles.indexOf(userRole || "tecnico");
    const requiredRoleIndex = roles.indexOf(requiredRole);

    if (requiredRole && currentRoleIndex < requiredRoleIndex) {
        // Si es técnico o coordinador intentando entrar a zona admin superior
        if (userRole === "tecnico" || userRole === "coordinador") {
            return <Navigate to="/portal-tecnico" replace />;
        }
        return <Navigate to="/" replace />;
    }

    return children;

    return children;
}
