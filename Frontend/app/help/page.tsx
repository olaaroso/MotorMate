"use client";

import { useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Car,
    ChevronDown,
    CircleHelp,
    Hammer,
    Mail,
    ShieldCheck,
    Wrench,
} from "lucide-react";

type FAQItem = {
    category: "Garage & Maintenance" | "Mechanics & Appointments" | "ToolDrop Rentals" | "Account & Security";
    question: string;
    answer: string;
};

const FAQS: FAQItem[] = [
    {
        category: "Garage & Maintenance",
        question: "How do I add a vehicle to My Garage?",
        answer:
            "Go to My Garage and enter your 17-character Vehicle Identification Number (VIN). MotorMate automatically decodes your vehicle's year, make, and model. You can also enter your current odometer reading and primary driving habits.",
    },
    {
        category: "Garage & Maintenance",
        question: "How do AI Maintenance Predictions work?",
        answer:
            "Our machine learning pipeline analyzes your vehicle's age, mileage, and driving habits to predict upcoming maintenance items and estimated repair costs. Completing the initial maintenance questionnaire unlocks your full personalized maintenance report.",
    },
    {
        category: "Garage & Maintenance",
        question: "Where do completed mechanic appointments go?",
        answer:
            "Whenever a mechanic marks your accepted appointment as Completed, the service details, mileage, final cost, and mechanic notes are automatically logged under your vehicle's Service History in My Garage.",
    },
    {
        category: "Mechanics & Appointments",
        question: "How do I book an appointment with a local mechanic?",
        answer:
            "Open Find Mechanics to search shops by service or location. Click View Shop to inspect their services, estimated prices, and available time slots, then submit a booking request for one of your Garage vehicles.",
    },
    {
        category: "Mechanics & Appointments",
        question: "Can I message a mechanic before my appointment?",
        answer:
            "Yes. Once you submit a service request, open My Appointments and click Open messages on the appointment card to chat directly with the shop while the request is Pending or Accepted.",
    },
    {
        category: "ToolDrop Rentals",
        question: "How does ToolDrop tool pickup and return verification work?",
        answer:
            "Both the tool owner and borrower confirm physical pickup and physical return in My Tools and My Rentals. Each step includes a Condition Report where you can upload photos—including via phone QR scan—to document the tool's condition before and after the rental.",
    },
    {
        category: "ToolDrop Rentals",
        question: "What happens to my security deposit on ToolDrop?",
        answer:
            "Your deposit is held during the active rental window and released once you return the tool and the owner completes their return inspection.",
    },
    {
        category: "Account & Security",
        question: "How do I reset or change my password?",
        answer:
            "If you are signed in, go to Account Settings and use the Change Password card. If you forgot your password on the Sign In screen, click 'Forgot password?' to verify your account details and set a new password immediately.",
    },
    {
        category: "Account & Security",
        question: "How do I delete my MotorMate account?",
        answer:
            "Open Account Settings from the top-right profile menu and scroll down to the Danger Zone section. Confirming account deletion permanently removes your profile and personal records.",
    },
];

const CATEGORIES = [
    { name: "All", icon: CircleHelp },
    { name: "Garage & Maintenance", icon: Car },
    { name: "Mechanics & Appointments", icon: Wrench },
    { name: "ToolDrop Rentals", icon: Hammer },
    { name: "Account & Security", icon: ShieldCheck },
] as const;

const FEEDBACK_MAILTO =
    "mailto:arosoj@farmingdale.edu?cc=legakm@farmingdale.edu,artj16@farmingdale.edu,santbj27@farmingdale.edu,willjt6@farmingdale.edu&subject=MotorMate%20Support%20%2F%20Question";

export default function HelpFaqPage() {
    const [selectedCategory, setSelectedCategory] = useState<string>("All");
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const visibleFaqs =
        selectedCategory === "All"
            ? FAQS
            : FAQS.filter((item) => item.category === selectedCategory);

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="bg-[#001F3F] px-6 py-12 text-white">
                <div className="mx-auto max-w-4xl">
                    <Link
                        href="/userDashboard"
                        className="inline-flex items-center gap-2 text-sm font-medium text-blue-200 transition hover:text-white"
                    >
                        <ArrowLeft size={16} />
                        Back to Dashboard
                    </Link>
                    <p className="mt-4 text-xs font-bold uppercase tracking-wider text-blue-300">
                        Support Center
                    </p>
                    <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
                        Frequently Asked Questions
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm text-slate-200 sm:text-base">
                        Quick answers for managing your Garage, booking local mechanics, and renting tools on ToolDrop.
                    </p>
                </div>
            </div>

            <div className="mx-auto max-w-5xl px-6 pb-12 pt-10">
                {/* Category Filter */}
                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-2">
                    {CATEGORIES.map(({ name, icon: Icon }) => {
                        const active = selectedCategory === name;
                        return (
                            <button
                                key={name}
                                type="button"
                                onClick={() => {
                                    setSelectedCategory(name);
                                    setOpenIndex(0);
                                }}
                                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition sm:text-sm ${
                                    active
                                        ? "bg-[#001F3F] text-white shadow-xs"
                                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                                }`}
                            >
                                <Icon size={15} />
                                {name}
                            </button>
                        );
                    })}
                </div>

                {/* Accordion List */}
                <div className="mt-6 space-y-3">
                    {visibleFaqs.map((faq, idx) => {
                        const isOpen = openIndex === idx;
                        return (
                            <div
                                key={faq.question}
                                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
                            >
                                <button
                                    type="button"
                                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                                    aria-expanded={isOpen}
                                    className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition hover:bg-slate-50"
                                >
                                    <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                      {faq.category}
                    </span>
                                        <h2 className="mt-0.5 text-base font-bold text-slate-900">
                                            {faq.question}
                                        </h2>
                                    </div>
                                    <ChevronDown
                                        size={18}
                                        className={`shrink-0 text-slate-400 transition-transform ${
                                            isOpen ? "rotate-180 text-[#001F3F]" : ""
                                        }`}
                                    />
                                </button>
                                {isOpen && (
                                    <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 text-sm leading-6 text-slate-600">
                                        {faq.answer}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Contact / Feedback Banner */}
                <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-blue-100 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
                    <div>
                        <h3 className="text-lg font-bold text-[#001F3F]">
                            Still have questions or spotted an issue?
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                            Send an email directly to the MotorMate development team.
                        </p>
                    </div>
                    <a
                        href={FEEDBACK_MAILTO}
                        className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#001F3F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#003366]"
                    >
                        <Mail size={16} />
                        Email Team Feedback
                    </a>
                </div>
            </div>
        </div>
    );
}