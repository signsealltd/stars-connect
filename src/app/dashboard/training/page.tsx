"use client";

import { Header } from "@/components/header";
import TrainingManager from "@/components/training-manager";
import "@/app/training-matrix.css";
export default function TrainingPage(){return <main className="shell"><Header manager/><div className="content"><div className="page-head"><div><h1 className="page-title">Staff training</h1><p className="muted">See training gaps, manage courses and approved providers, and plan renewals from one matrix.</p></div></div><TrainingManager/></div></main>}
