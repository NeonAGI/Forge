import React from "react";
import { Dashboard as DashboardComponent } from "@/components/dashboard";
import { Helmet } from "react-helmet";

const Dashboard: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>AI Lifestyle Dashboard</title>
        <meta 
          name="description" 
          content="A modern AI-powered lifestyle dashboard with frosted glass UI, featuring real-time widgets and OpenAI voice/text assistance" 
        />
      </Helmet>
      <DashboardComponent />
    </>
  );
};

export default Dashboard;
