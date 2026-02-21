"use client";

import { useState, type ReactNode } from "react";
import { useIdentityStore } from "@/stores/identityStore";
import { SUPPORTED_COUNCILS } from "@/types/identity";
import type { UserRole, Council } from "@/types/identity";

/**
 * Wraps the app and shows a modal overlay until the user identifies themselves.
 * No auth — just role + council selection, persisted to localStorage.
 */
export function IdentityGate({ children }: { children: ReactNode }) {
  const { isIdentified } = useIdentityStore();

  return (
    <>
      {children}
      {!isIdentified && <IdentityModal />}
    </>
  );
}

function IdentityModal() {
  const { setIdentity } = useIdentityStore();
  const [step, setStep] = useState<"role" | "council">("role");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [selectedCouncil, setSelectedCouncil] = useState<Council | null>(null);

  function handleRoleSelect(role: UserRole) {
    setSelectedRole(role);
    setStep("council");
  }

  function handleConfirm() {
    if (!selectedRole || !selectedCouncil) return;
    setIdentity(selectedRole, selectedCouncil);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/90 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
        {/* Logo / header */}
        <div className="mb-6">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            CityZenith
          </span>
          <h1 className="text-xl font-semibold text-white mt-1">
            {step === "role" ? "Who are you?" : "Select your council"}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {step === "role"
              ? "Insights are tailored to your role"
              : "Choose the council area you are working with"}
          </p>
        </div>

        {/* Step 1 — role selection */}
        {step === "role" && (
          <div className="space-y-3">
            <RoleCard
              title="Developer"
              description="Assessing planning potential, investment risk, and development opportunity at specific sites"
              icon="🏗️"
              onClick={() => handleRoleSelect("developer")}
            />
            <RoleCard
              title="Council Officer"
              description="Evaluating planning applications, assessing development proposals, and monitoring the plan area"
              icon="🏛️"
              onClick={() => handleRoleSelect("council")}
            />
          </div>
        )}

        {/* Step 2 — council selection */}
        {step === "council" && (
          <div className="space-y-3">
            <div className="grid gap-2">
              {SUPPORTED_COUNCILS.map((council) => (
                <button
                  key={council.id}
                  onClick={() => setSelectedCouncil(council)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    selectedCouncil?.id === council.id
                      ? "bg-violet-900/50 border-violet-600 text-white"
                      : "bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{council.name}</p>
                      {council.planCorpus ? (
                        <p className="text-xs text-violet-400 mt-0.5">
                          Local plan indexed ✓
                        </p>
                      ) : (
                        <p className="text-xs text-gray-600 mt-0.5">
                          No local plan corpus
                        </p>
                      )}
                    </div>
                    {selectedCouncil?.id === council.id && <CheckIcon />}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setStep("role")}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 text-gray-400 text-sm
                  hover:border-gray-600 hover:text-gray-300 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selectedCouncil}
                className="flex-[2] px-6 py-2.5 rounded-xl bg-violet-700 hover:bg-violet-600
                  disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium
                  transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RoleCard({
  title,
  description,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-4 rounded-xl border border-gray-700 bg-gray-800/50
        hover:bg-gray-800 hover:border-gray-600 transition-colors group"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5 shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{title}</p>
          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
            {description}
          </p>
        </div>
        <ChevronRightIcon />
      </div>
    </button>
  );
}

/**
 * Small floating badge shown in the map corner once identity is set.
 * Allows users to switch their role/council without reloading.
 */
export function IdentityBadge() {
  const { role, council, isIdentified, clearIdentity } = useIdentityStore();

  if (!isIdentified || !role || !council) return null;

  const isDeveloper = role === "developer";

  return (
    <div
      className="absolute bottom-4 left-4 z-10
      bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-2xl
      px-4 py-3 shadow-xl flex items-center gap-3"
    >
      {/* Role icon + label */}
      <div className="flex flex-col items-center gap-0.5 min-w-[48px]">
        <span className="text-3xl leading-none">
          {isDeveloper ? "🏗️" : "🏛️"}
        </span>
        <span
          className={`text-[10px] font-bold uppercase tracking-widest ${
            isDeveloper ? "text-amber-400" : "text-violet-400"
          }`}
        >
          {isDeveloper ? "Developer" : "Council"}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-9 bg-gray-700" />

      {/* Council name */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
          Council
        </span>
        <span className="text-sm font-semibold text-white leading-tight">
          {council.name}
        </span>
      </div>

      {/* Switch button */}
      <button
        onClick={clearIdentity}
        title="Switch identity"
        className="ml-1 p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-1.5 4 1.5 4-1.5 4 1.5z"
          />
        </svg>
      </button>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      className="w-4 h-4 text-violet-400 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      className="w-4 h-4 text-gray-600 group-hover:text-gray-400 shrink-0 mt-0.5 transition-colors"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
