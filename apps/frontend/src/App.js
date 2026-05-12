import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { MsalProvider, useMsal, useIsAuthenticated } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { createBooking, getMe, listBookings, queryRecommendations, setMsalInstance } from './shared/api/client';
function BookingApp() {
    const { instance, accounts } = useMsal();
    const isAuthenticated = useIsAuthenticated();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bookingDate, setBookingDate] = useState(new Date().toISOString().slice(0, 10));
    const [collaborators, setCollaborators] = useState('');
    const [candidates, setCandidates] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [message, setMessage] = useState('');
    useEffect(() => {
        const load = async () => {
            try {
                const me = await getMe();
                setUser(me);
                const myBookings = await listBookings();
                setBookings(myBookings?.bookings ?? []);
            }
            catch (error) {
                setMessage('Unable to load user context. Check browser console for token/API errors.');
            }
            finally {
                setLoading(false);
            }
        };
        if (isAuthenticated) {
            load();
        }
        else {
            setLoading(false);
        }
    }, [isAuthenticated]);
    const handleLogin = async () => {
        try {
            await instance.loginPopup({
                scopes: (import.meta.env.VITE_ENTRA_SCOPES || 'openid profile email').split(' '),
            });
        }
        catch (error) {
            console.error('Login failed:', error);
            setMessage('Login failed. Check console.');
        }
    };
    const handleLogout = () => {
        instance.logoutPopup();
    };
    const onRecommend = async () => {
        const response = await queryRecommendations({
            officeId: 'office-london-mvp',
            bookingDate,
            collaborators: collaborators
                .split(',')
                .map((x) => x.trim())
                .filter(Boolean),
        });
        setCandidates(response?.candidates ?? []);
        setMessage(`Found ${response?.candidates?.length ?? 0} desk candidates.`);
    };
    const onBook = async (candidate) => {
        const result = await createBooking({
            officeId: 'office-london-mvp',
            deskId: candidate.deskId,
            neighbourhoodId: candidate.neighbourhoodId,
            bookingDate,
            collaboratorIds: collaborators
                .split(',')
                .map((x) => x.trim())
                .filter(Boolean),
        });
        setMessage(`Booking created: ${result?.booking?.id ?? 'unknown'}`);
        const myBookings = await listBookings();
        setBookings(myBookings?.bookings ?? []);
    };
    if (!isAuthenticated) {
        return (_jsxs("div", { className: "app", children: [_jsx("header", { children: _jsx("h1", { children: "Team Orbit" }) }), _jsx("main", { children: _jsxs("section", { children: [_jsx("p", { children: "Sign in to book desks near your collaborators." }), _jsx("button", { onClick: handleLogin, children: "Sign In with Entra" })] }) })] }));
    }
    if (loading) {
        return _jsx("div", { className: "app", children: "Loading Team Orbit..." });
    }
    return (_jsxs("div", { className: "app", children: [_jsxs("header", { children: [_jsx("h1", { children: "Team Orbit" }), user && _jsxs("span", { children: ["Logged in as: ", user.displayName] }), _jsx("button", { onClick: handleLogout, style: { marginLeft: 'auto' }, children: "Sign Out" })] }), _jsxs("main", { children: [_jsxs("section", { children: [_jsx("h2", { children: "Book Near Collaborators" }), _jsxs("label", { children: ["Booking date", _jsx("input", { type: "date", value: bookingDate, onChange: (e) => setBookingDate(e.target.value) })] }), _jsxs("label", { children: ["Collaborator IDs (comma separated)", _jsx("input", { type: "text", value: collaborators, onChange: (e) => setCollaborators(e.target.value), placeholder: "user-1,user-2" })] }), _jsx("button", { onClick: onRecommend, children: "Get Recommendations" })] }), _jsxs("section", { children: [_jsx("h3", { children: "Recommended Desks" }), candidates.length === 0 && _jsx("p", { children: "No recommendations yet." }), candidates.map((candidate) => (_jsxs("div", { className: "card", children: [_jsxs("div", { children: [_jsx("strong", { children: candidate.deskId }), _jsx("p", { children: candidate.neighbourhoodId }), _jsx("small", { children: candidate.rationale })] }), _jsx("button", { onClick: () => onBook(candidate), children: "Book" })] }, candidate.deskId)))] }), _jsxs("section", { children: [_jsx("h3", { children: "My Bookings" }), bookings.length === 0 && _jsx("p", { children: "No bookings yet." }), bookings.map((b) => (_jsxs("div", { className: "card", children: [_jsx("strong", { children: b.deskId }), _jsxs("p", { children: [b.bookingDate, " | ", b.status] })] }, b.id)))] }), message && _jsx("p", { children: message })] })] }));
}
const msalConfig = {
    auth: {
        clientId: import.meta.env.VITE_ENTRA_CLIENT_ID || '993fb07a-161e-452f-9081-f2db2e6b5930',
        authority: import.meta.env.VITE_ENTRA_AUTHORITY || 'https://login.microsoftonline.com/a96476fa-ab5b-4694-88e2-5843ab149973',
        redirectUri: import.meta.env.VITE_ENTRA_REDIRECT_URI || 'http://localhost:5173',
    },
    cache: {
        cacheLocation: 'localStorage',
    },
};
const pca = new PublicClientApplication(msalConfig);
setMsalInstance(pca);
function App() {
    return (_jsx(MsalProvider, { instance: pca, children: _jsx(BookingApp, {}) }));
}
export default App;
