import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  signInWithPopup
} from 'firebase/auth';
import { auth, db, googleProvider } from './firebaseClient';
import { Member, Post, TrainingResource, AppNotification, ClusterVictory, DiscussionMessage, Comment } from '../types';

export const storageService = {
  // --- AUTHENTIFICATION ---
  getCurrentUser: async (): Promise<Member | null> => {
    return new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
        unsubscribe();
        if (firebaseUser) {
          try {
            const userDoc = await getDoc(doc(db, 'members', firebaseUser.uid));
            if (userDoc.exists()) {
              resolve({ id: userDoc.id, ...userDoc.data() } as Member);
            } else {
              // Si le document profil n'existe pas encore (ex: premier login Google Auth)
              const newMember: Member = {
                id: firebaseUser.uid,
                name: firebaseUser.displayName || 'Utilisatrice',
                email: firebaseUser.email || '',
                avatar: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || 'User')}&background=random`,
                joinedDate: new Date().toLocaleDateString(),
                status: 'En Formation',
                trainingProgress: 0,
                badges: ['Nouvelle'],
                role: 'MEMBER',
                completedTrainings: [],
                businessName: '',
                sector: '',
                location: { lat: -4.4419, lng: 15.2663, address: '', city: 'Kinshasa' }
              };
              await setDoc(doc(db, 'members', firebaseUser.uid), newMember);
              resolve(newMember);
            }
          } catch (e) {
            console.error("Error fetching user profile", e);
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });
  },

  login: async (email: string, password?: string): Promise<Member | null> => {
    // Si pas de password, on suppose une connexion Google (via signInWithGoogle)
    if (!password) {
      throw new Error("Mot de passe requis pour la connexion par email");
    }
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, 'members', userCredential.user.uid));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() } as Member;
    }
    throw new Error('Profil utilisateur introuvable');
  },

  signInWithGoogle: async (): Promise<Member | null> => {
    const userCredential = await signInWithPopup(auth, googleProvider);
    const userDoc = await getDoc(doc(db, 'members', userCredential.user.uid));

    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() } as Member;
    } else {
      const newMember: Member = {
        id: userCredential.user.uid,
        name: userCredential.user.displayName || 'Utilisatrice Google',
        email: userCredential.user.email || '',
        avatar: userCredential.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userCredential.user.displayName || 'User')}`,
        joinedDate: new Date().toLocaleDateString(),
        status: 'En Formation',
        trainingProgress: 0,
        badges: ['Nouvelle'],
        role: 'MEMBER',
        completedTrainings: [],
        businessName: '',
        sector: '',
        location: { lat: -4.4419, lng: 15.2663, address: '', city: 'Kinshasa' }
      };
      await setDoc(doc(db, 'members', userCredential.user.uid), newMember);
      return newMember;
    }
  },

  register: async (userData: Partial<Member> & { city?: string; address?: string; password?: string }): Promise<Member> => {
    if (!userData.email || !userData.password) throw new Error("Email et mot de passe requis");

    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);

    const newUser: Member = {
      id: userCredential.user.uid,
      name: userData.name || 'Utilisatrice',
      email: userData.email,
      businessName: userData.businessName || '',
      sector: userData.sector || '',
      location: {
        lat: -4.4419 + (Math.random() - 0.5) * 0.01,
        lng: 15.2663 + (Math.random() - 0.5) * 0.01,
        address: userData.address || '',
        city: userData.city || 'Kinshasa'
      },
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || 'User')}&background=random`,
      joinedDate: new Date().toLocaleDateString(),
      status: 'En Formation',
      trainingProgress: 0,
      badges: ['Nouvelle'],
      role: userData.role || 'MEMBER',
      completedTrainings: []
    };

    await setDoc(doc(db, 'members', userCredential.user.uid), newUser);
    return newUser;
  },

  logout: async () => {
    await signOut(auth);
  },

  // --- POSTS ---
  getPosts: async (): Promise<Post[]> => {
    const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Post));
  },

  addPost: async (post: Post): Promise<void> => {
    const newPostData = {
      ...post,
      likes: 0,
      comments: 0,
      likedBy: [],
      timestamp: new Date().toISOString(), // Using ISO string for better sorting in Firestore
    };
    // remove id if it exists so firestore auto-generates it correctly or we use addDoc
    const { id, ...dataToSave } = newPostData;
    await addDoc(collection(db, 'posts'), dataToSave);
  },

  deletePost: async (postId: string): Promise<void> => {
    await deleteDoc(doc(db, 'posts', postId));
  },

  updatePost: async (post: Post): Promise<void> => {
    const { id, ...dataToUpdate } = post;
    await updateDoc(doc(db, 'posts', id), dataToUpdate as any);
  },

  // --- MEMBRES ---
  getAllMembers: async (): Promise<Member[]> => {
    const snapshot = await getDocs(collection(db, 'members'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
  },

  updateUser: async (userId: string, updates: any): Promise<Member | null> => {
    const userRef = doc(db, 'members', userId);
    await updateDoc(userRef, updates);
    const updatedDoc = await getDoc(userRef);
    return updatedDoc.exists() ? { id: updatedDoc.id, ...updatedDoc.data() } as Member : null;
  },

  updateUserLocation: async (userId: string, coords: any, details: any) => {
    await storageService.updateUser(userId, { location: { ...coords, ...details } });
  },

  // --- FORMATIONS ---
  getTrainings: async (): Promise<TrainingResource[]> => {
    const snapshot = await getDocs(collection(db, 'trainings'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingResource));
  },

  addTraining: async (training: TrainingResource): Promise<void> => {
    const { id, ...data } = training;
    await addDoc(collection(db, 'trainings'), data);
  },

  markTrainingCompleted: async (userId: string, trainingId: string) => {
    const userDoc = await getDoc(doc(db, 'members', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data() as Member;
      const completed = userData.completedTrainings || [];
      if (!completed.includes(trainingId)) {
        await updateDoc(doc(db, 'members', userId), { completedTrainings: [...completed, trainingId] });
      }
    }
  },

  // --- COMMENTAIRES ---
  getCommentsForPost: async (postId: string): Promise<Comment[]> => {
    const q = query(collection(db, 'comments'), where('postId', '==', postId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
  },

  addComment: async (postId: string, content: string, authorId: string) => {
    const userDoc = await getDoc(doc(db, 'members', authorId));
    const authorName = userDoc.exists() ? userDoc.data().name : 'Membre';

    const newComment = {
      postId,
      authorId,
      authorName,
      content,
      timestamp: new Date().toISOString()
    };

    await addDoc(collection(db, 'comments'), newComment);

    // Increment post comment count
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    if (postSnap.exists()) {
      await updateDoc(postRef, { comments: (postSnap.data().comments || 0) + 1 });
    }
  },

  // --- DISCUSSION GÉNÉRALE ---
  getDiscussionMessages: async (limitCount = 15, beforeTimestamp?: string) => {
    const q = query(collection(db, 'messages'), orderBy('timestamp', 'desc'), firestoreLimit(limitCount));
    const snapshot = await getDocs(q);
    const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DiscussionMessage));
    return msgs.reverse(); // Return chronological
  },

  addDiscussionMessage: async (msgData: { authorId: string, content: string }) => {
    const userDoc = await getDoc(doc(db, 'members', msgData.authorId));
    const userData = userDoc.exists() ? userDoc.data() as Member : null;

    const newMsg = {
      authorId: msgData.authorId,
      authorName: userData?.name || 'Membre',
      authorAvatar: userData?.avatar || '',
      content: msgData.content,
      timestamp: new Date().toISOString(),
      displayTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const docRef = await addDoc(collection(db, 'messages'), newMsg);
    return { id: docRef.id, ...newMsg } as DiscussionMessage;
  },

  deleteDiscussionMessage: async (msgId: string) => {
    await deleteDoc(doc(db, 'messages', msgId));
  },

  // --- LOGIQUE ADMIN (Maintenant Firestore) ---
  getNotifications: async (): Promise<AppNotification[]> => {
    const snapshot = await getDocs(collection(db, 'notifications'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as AppNotification));
  },

  addNotification: async (notification: AppNotification) => {
    const { id, ...data } = notification as any;
    await addDoc(collection(db, 'notifications'), data);
  },

  getStrategicGoals: async (): Promise<any[]> => {
    const snapshot = await getDocs(collection(db, 'goals'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  addStrategicGoal: async (text: string) => {
    await addDoc(collection(db, 'goals'), { text, isCompleted: false });
    return storageService.getStrategicGoals();
  },

  toggleStrategicGoal: async (id: string) => {
    const goalRef = doc(db, 'goals', id);
    const goalSnap = await getDoc(goalRef);
    if (goalSnap.exists()) {
      await updateDoc(goalRef, { isCompleted: !goalSnap.data().isCompleted });
    }
    return storageService.getStrategicGoals();
  },

  deleteStrategicGoal: async (id: string) => {
    await deleteDoc(doc(db, 'goals', id));
    return storageService.getStrategicGoals();
  },

  getVictories: async (): Promise<ClusterVictory[]> => {
    const snapshot = await getDocs(collection(db, 'victories'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClusterVictory));
  },

  addVictory: async (v: ClusterVictory) => {
    const { id, ...data } = v as any;
    await addDoc(collection(db, 'victories'), data);
    return storageService.getVictories();
  },

  updateVictory: async (id: string, data: any) => {
    await updateDoc(doc(db, 'victories', id), data);
    return storageService.getVictories();
  },

  deleteVictory: async (id: string) => {
    await deleteDoc(doc(db, 'victories', id));
    return storageService.getVictories();
  },

  saveFcmToken: async (userId: string, token: string): Promise<void> => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { fcmToken: token });
    } catch (error) {
      console.error("Error saving FCM token", error);
    }
  }
};
