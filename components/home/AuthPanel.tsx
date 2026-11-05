"use client";
import { useAuth } from "@/hooks/useAuth";
import { GraphUser } from "@/lib/types";
import { useEffect, useState } from "react";

export default function AuthPanel() {
    const {getProfile, isAttorney} = useAuth();
    const [loading, setLoading] = useState(true);
    const [currentProfile, setProfile] = useState<GraphUser | null>(null);
    useEffect(() => {
        getProfile().then((profile) => {
            setProfile(profile);
            setLoading(false);
        });
    }, [getProfile]);

    if (loading) {
        return <div>Loading profile...</div>;
    }
    if (!currentProfile) {
        return <div>No profile available.</div>;
    }
    return (
        <div className="sm:w-xl lg:w-5xl xl:w-7xl lg:max-w-7xl p-6">
            <h2 className="text-2xl">Welcome back, {currentProfile.displayName}</h2>
            {isAttorney ? (
                <h3 className="mt-4 text-lg">Attorney at Law</h3>
            ) : null}
            {
                currentProfile?.createdDateTime ? (
                    <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
                        Member since: {new Date(currentProfile.createdDateTime).toLocaleDateString()}
                    </p>
                ) : null
            }
        </div>
    );
}