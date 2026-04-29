"use client";

import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import {
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where
} from "firebase/firestore";
import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, db, googleProvider } from "@/lib/firebase";

export default function DeleteAccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  async function requestDeletion() {
    if (!user || confirmation !== user.email) return;
    setError("");
    try {
      const memberships = await getDocs(
        query(collectionGroup(db, "members"), where("uid", "==", user.uid))
      );
      await Promise.all(
        memberships.docs.map((membership) =>
          updateDoc(membership.ref, { status: "left", deletionRequested: true })
        )
      );
      await deleteDoc(doc(db, "users", user.uid));
      setMessage("Solicitacao concluida. Sua conta local foi removida e seus acessos sairam dos workspaces.");
      await signOut(auth);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel excluir agora.");
    }
  }

  return (
    <main className="page legal-doc">
      <Link className="btn secondary" href="/">
        Voltar
      </Link>
      <h1>Excluir conta</h1>
      <p>
        Voce pode remover seu perfil e sair dos workspaces compartilhados. Se voce for owner
        de um workspace, exclua o workspace pelo painel antes de remover a conta.
      </p>

      {!user ? (
        <button className="btn" onClick={() => signInWithPopup(auth, googleProvider)}>
          Entrar com Google
        </button>
      ) : (
        <div className="card auth-card section">
          <p className="muted">
            Digite seu e-mail para confirmar: <strong>{user.email}</strong>
          </p>
          <input
            className="input"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          <button className="btn danger" disabled={confirmation !== user.email} onClick={requestDeletion}>
            Excluir minha conta
          </button>
        </div>
      )}

      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}
    </main>
  );
}
