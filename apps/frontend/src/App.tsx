import React, { useEffect, useState } from 'react';
import { MsalProvider, useMsal, useIsAuthenticated } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { createBooking, getMe, listBookings, queryRecommendations, setMsalInstance } from './shared/api/client';

type Me = {
  userId: string;
  email: string;
  displayName: string;
};

type Candidate = {
  deskId: string;
  neighbourhoodId: string;
  score: number;
  rationale: string;
};

function BookingApp() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().slice(0, 10));
  const [collaborators, setCollaborators] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const me = await getMe();
        setUser(me);
        const myBookings = await listBookings();
        setBookings(myBookings?.bookings ?? []);
      } catch (error) {
        setMessage('Unable to load user context. Check browser console for token/API errors.');
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      load();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const handleLogin = async () => {
    try {
      await instance.loginPopup({
        scopes: (import.meta.env.VITE_ENTRA_SCOPES || 'openid profile email').split(' '),
      });
    } catch (error) {
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

  const onBook = async (candidate: Candidate) => {
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
    return (
      <div className="app">
        <header>
          <h1>Team Orbit</h1>
        </header>
        <main>
          <section>
            <p>Sign in to book desks near your collaborators.</p>
            <button onClick={handleLogin}>Sign In with Entra</button>
          </section>
        </main>
      </div>
    );
  }

  if (loading) {
    return <div className="app">Loading Team Orbit...</div>;
  }

  return (
    <div className="app">
      <header>
        <h1>Team Orbit</h1>
        {user && <span>Logged in as: {user.displayName}</span>}
        <button onClick={handleLogout} style={{ marginLeft: 'auto' }}>Sign Out</button>
      </header>
      <main>
        <section>
          <h2>Book Near Collaborators</h2>
          <label>
            Booking date
            <input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} />
          </label>
          <label>
            Collaborator IDs (comma separated)
            <input
              type="text"
              value={collaborators}
              onChange={(e) => setCollaborators(e.target.value)}
              placeholder="user-1,user-2"
            />
          </label>
          <button onClick={onRecommend}>Get Recommendations</button>
        </section>

        <section>
          <h3>Recommended Desks</h3>
          {candidates.length === 0 && <p>No recommendations yet.</p>}
          {candidates.map((candidate) => (
            <div key={candidate.deskId} className="card">
              <div>
                <strong>{candidate.deskId}</strong>
                <p>{candidate.neighbourhoodId}</p>
                <small>{candidate.rationale}</small>
              </div>
              <button onClick={() => onBook(candidate)}>Book</button>
            </div>
          ))}
        </section>

        <section>
          <h3>My Bookings</h3>
          {bookings.length === 0 && <p>No bookings yet.</p>}
          {bookings.map((b) => (
            <div key={b.id} className="card">
              <strong>{b.deskId}</strong>
              <p>
                {b.bookingDate} | {b.status}
              </p>
            </div>
          ))}
        </section>

        {message && <p>{message}</p>}
      </main>
    </div>
  );
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
  return (
    <MsalProvider instance={pca}>
      <BookingApp />
    </MsalProvider>
  );
}

export default App;
