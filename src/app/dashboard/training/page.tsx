"use client";

import { Header } from "@/components/header";
import TrainingManager from "@/components/training-manager";
import "@/app/training-matrix.css";
import "@/app/training-redesign.css";
export default function TrainingPage(){return <main className="shell training-page"><Header manager/><div className="content"><TrainingManager/></div></main>}
