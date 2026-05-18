"use client";

import { useEffect } from "react";
import useViewTracker from "../hooks/useViewTracker";

const ViewTracker = ({ host }: { host: string }) => {
    const projectName = host.replace("www.", "").replace(".com", "");
    useViewTracker(projectName);

    // This component renders nothing, it just handles the tracking
    return null;
};

export default ViewTracker;