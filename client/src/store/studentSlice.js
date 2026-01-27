import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
    getDashboard,
    getSyllabi,
    getAnalytics,
    getWeakTopics,
    getSessionHistory,
} from "../services/openai";

// Async thunks
export const fetchDashboard = createAsyncThunk(
    "student/fetchDashboard",
    async (_, { rejectWithValue }) => {
        try {
            const data = await getDashboard();
            return data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.error || "Failed to load dashboard");
        }
    }
);

export const fetchSyllabi = createAsyncThunk(
    "student/fetchSyllabi",
    async (_, { rejectWithValue }) => {
        try {
            const data = await getSyllabi();
            return data.syllabi;
        } catch (error) {
            return rejectWithValue(error.response?.data?.error || "Failed to load syllabi");
        }
    }
);

export const fetchAnalytics = createAsyncThunk(
    "student/fetchAnalytics",
    async (_, { rejectWithValue }) => {
        try {
            const data = await getAnalytics();
            return data.analytics;
        } catch (error) {
            return rejectWithValue(error.response?.data?.error || "Failed to load analytics");
        }
    }
);

export const fetchWeakTopics = createAsyncThunk(
    "student/fetchWeakTopics",
    async (_, { rejectWithValue }) => {
        try {
            const data = await getWeakTopics();
            return data.weakTopics;
        } catch (error) {
            return rejectWithValue(error.response?.data?.error || "Failed to load weak topics");
        }
    }
);

export const fetchSessionHistory = createAsyncThunk(
    "student/fetchSessionHistory",
    async (params, { rejectWithValue }) => {
        try {
            const data = await getSessionHistory(params);
            return data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.error || "Failed to load session history");
        }
    }
);

const initialState = {
    // Dashboard
    dashboard: null,
    dashboardLoading: false,
    dashboardError: null,

    // Syllabi
    syllabi: [],
    syllabiLoading: false,
    syllabiError: null,

    // Current session
    currentSession: null,
    sessionLoading: false,
    sessionError: null,

    // Analytics
    analytics: null,
    analyticsLoading: false,
    analyticsError: null,

    // Weak topics
    weakTopics: [],
    weakTopicsLoading: false,
    weakTopicsError: null,

    // Session history
    sessionHistory: [],
    sessionHistoryLoading: false,
    sessionHistoryError: null,
    sessionHistoryPagination: null,
};

const studentSlice = createSlice({
    name: "student",
    initialState,
    reducers: {
        setCurrentSession: (state, action) => {
            state.currentSession = action.payload;
        },
        clearCurrentSession: (state) => {
            state.currentSession = null;
        },
        updateSessionAnswer: (state, action) => {
            if (state.currentSession) {
                const { questionId, answer } = action.payload;
                const existingAnswer = state.currentSession.answers?.find(
                    (a) => a.questionId === questionId
                );
                if (existingAnswer) {
                    existingAnswer.userAnswer = answer;
                } else {
                    state.currentSession.answers = [
                        ...(state.currentSession.answers || []),
                        { questionId, userAnswer: answer },
                    ];
                }
            }
        },
        clearErrors: (state) => {
            state.dashboardError = null;
            state.syllabiError = null;
            state.sessionError = null;
            state.analyticsError = null;
            state.weakTopicsError = null;
            state.sessionHistoryError = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // Dashboard
            .addCase(fetchDashboard.pending, (state) => {
                state.dashboardLoading = true;
                state.dashboardError = null;
            })
            .addCase(fetchDashboard.fulfilled, (state, action) => {
                state.dashboardLoading = false;
                state.dashboard = action.payload;
            })
            .addCase(fetchDashboard.rejected, (state, action) => {
                state.dashboardLoading = false;
                state.dashboardError = action.payload;
            })
            // Syllabi
            .addCase(fetchSyllabi.pending, (state) => {
                state.syllabiLoading = true;
                state.syllabiError = null;
            })
            .addCase(fetchSyllabi.fulfilled, (state, action) => {
                state.syllabiLoading = false;
                state.syllabi = action.payload;
            })
            .addCase(fetchSyllabi.rejected, (state, action) => {
                state.syllabiLoading = false;
                state.syllabiError = action.payload;
            })
            // Analytics
            .addCase(fetchAnalytics.pending, (state) => {
                state.analyticsLoading = true;
                state.analyticsError = null;
            })
            .addCase(fetchAnalytics.fulfilled, (state, action) => {
                state.analyticsLoading = false;
                state.analytics = action.payload;
            })
            .addCase(fetchAnalytics.rejected, (state, action) => {
                state.analyticsLoading = false;
                state.analyticsError = action.payload;
            })
            // Weak topics
            .addCase(fetchWeakTopics.pending, (state) => {
                state.weakTopicsLoading = true;
                state.weakTopicsError = null;
            })
            .addCase(fetchWeakTopics.fulfilled, (state, action) => {
                state.weakTopicsLoading = false;
                state.weakTopics = action.payload;
            })
            .addCase(fetchWeakTopics.rejected, (state, action) => {
                state.weakTopicsLoading = false;
                state.weakTopicsError = action.payload;
            })
            // Session history
            .addCase(fetchSessionHistory.pending, (state) => {
                state.sessionHistoryLoading = true;
                state.sessionHistoryError = null;
            })
            .addCase(fetchSessionHistory.fulfilled, (state, action) => {
                state.sessionHistoryLoading = false;
                state.sessionHistory = action.payload.sessions;
                state.sessionHistoryPagination = action.payload.pagination;
            })
            .addCase(fetchSessionHistory.rejected, (state, action) => {
                state.sessionHistoryLoading = false;
                state.sessionHistoryError = action.payload;
            });
    },
});

export const {
    setCurrentSession,
    clearCurrentSession,
    updateSessionAnswer,
    clearErrors,
} = studentSlice.actions;

export default studentSlice.reducer;
