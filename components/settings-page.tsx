"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { tabs } from '@/lib/settings';

export default function SettingsPage() {
    const [selectedTab, setSelectedTab] = useState(tabs[0].name);

    return (
        <div className="flex flex-col gap-4">
             <div className="flex gap-2">
                {tabs.map((tab) => (
                    <Button
                        key={tab.name}
                        onClick={() => setSelectedTab(tab.name)}
                        variant={selectedTab === tab.name ? "default" : "secondary"}
                        size={"sm"}
                    >
                        {tab.name}
                    </Button>
                ))}
            </div>

             {/* Body */}
             {tabs.find((tab) => tab.name === selectedTab) && (
                <div>{tabs.find((tab) => tab.name === selectedTab)?.description}</div>
            )}
        </div>
    );
}