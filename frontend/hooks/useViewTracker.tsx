"use client";

import { useEffect } from "react";

const useViewTracker = (projectName: string) => {
    useEffect(() => {
        const trackView = async () => {
            try {
                const response = await fetch(
                    "https://views.sc0rp10n.space/api/views",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            projectName: projectName,
                            url: window.location.origin,
                        }),
                    }
                );

                if (response.ok) {
                    // Optionally handle response data here if needed
                    console.log("View tracked for " + projectName);
                }
            } catch (error) {
                console.error("Error tracking view:", error);
            }
        };

        // Track view when component mounts
        trackView();
    }, [projectName]);
};

export default useViewTracker;