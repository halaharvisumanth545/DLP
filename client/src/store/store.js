import { configureStore } from "@reduxjs/toolkit";
import studentReducer from "./studentSlice";

export const store = configureStore({
    reducer: {
        student: studentReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false,
        }),
});

export default store;
