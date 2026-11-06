'use client';
import { logger } from '@/lib/logger';
import BarAdmissionsEditor from '@/components/profile/BarAdmissionsEditor';
import { FormActions, FormSection } from '@/components/forms/FormSection';
import SearchableSelect, {
  type SearchableSelectOption,
} from '@/components/profile/SearchableSelect';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import PageTemplate from '@/components/PageTemplate';
import { useAuth } from '@/hooks/useAuth';
import { emitNotification } from '@/lib/notificationEvents';
import {
  BarAdmissionsResponseSchema,
  JurisdictionsResponseSchema,
  type BarAdmission,
  type JurisdictionsResponse,
  GraphUser,
  parseGraphUser,
} from '@/lib/types';
import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
import { useForm } from '@tanstack/react-form';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

const SCOPES = process.env.NEXT_PUBLIC_AAD_API_SCOPE!.split(',');

type SaveResultState = {
  open: boolean;
  success: boolean;
  title: string;
  message: string;
};

type BarAdmissionsLoadState = 'idle' | 'loading' | 'success' | 'error';

type ProfileFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isAttorney: boolean;
  barAdmissions: BarAdmission[];
};

const EMPTY_PROFILE_FORM_VALUES: ProfileFormValues = {
  firstName: '',
  lastName: '',
  phone: '',
  streetAddress: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  isAttorney: false,
  barAdmissions: [],
};

const formatDateTimeForLocale = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsedDate);
};

const mapProfileToFormValues = (
  profile: GraphUser,
  barAdmissions: BarAdmission[] = [],
): ProfileFormValues => ({
  firstName: profile.givenName ?? '',
  lastName: profile.surname ?? '',
  phone: String(profile.mobilePhone ?? ''),
  streetAddress: profile.streetAddress ?? '',
  city: profile.city ?? '',
  state: profile.state ?? '',
  postalCode: profile.postalCode ?? '',
  country: profile.country ?? '',
  isAttorney:
    profile.isAttorney ??
    false,
  barAdmissions,
});

export default function Page() {
  const router = useRouter();

  const {
    account,
    getProfile,
    getProfilePhoto,
    getToken,
    fetchWithAuth,
    signIn,
    setCachedProfile,
    invalidateCachedProfilePhoto,
  } = useAuth();
  const [profile, setProfile] = useState<GraphUser | null>(null);
  const [barAdmissions, setBarAdmissions] = useState<BarAdmission[]>([]);
  const [jurisdictions, setJurisdictions] =
    useState<JurisdictionsResponse | null>(null);
  const [jurisdictionsError, setJurisdictionsError] = useState(false);
  const jurisdictionsRequest = useRef<Promise<JurisdictionsResponse> | null>(
    null,
  );
  const [barAdmissionsLoadState, setBarAdmissionsLoadState] =
    useState<BarAdmissionsLoadState>('idle');
  const barAdmissionsRequest = useRef<Promise<BarAdmission[]> | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<string | null | undefined>(
    undefined,
  );
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);
  const [isEditable, setIsEditable] = useState<boolean>(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveResult, setSaveResult] = useState<SaveResultState>({
    open: false,
    success: true,
    title: '',
    message: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const wasSaveResultOpenRef = useRef(false);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState<boolean>(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(false);
  const [isPhotoLoaded, setIsPhotoLoaded] = useState<boolean>(false);
  const [isProfileLoaded, setIsProfileLoaded] = useState<boolean>(false);
  const isAttorney =
    profile?.isAttorney ??
    false;
  const isBarAdmissionsReady =
    !isAttorney || barAdmissionsLoadState === 'success';

  const profileDefaultValues = useMemo(
    () =>
      profile
        ? mapProfileToFormValues(profile, barAdmissions)
        : EMPTY_PROFILE_FORM_VALUES,
    [profile, barAdmissions],
  );

  const stateOptions = useMemo<SearchableSelectOption[]>(
    () =>
      jurisdictions?.states
        .filter((jurisdiction) => jurisdiction.countryCode === 'US')
        .map((jurisdiction) => ({
          value: jurisdiction.name,
          label: `${jurisdiction.name} (${jurisdiction.type})`,
          searchText: jurisdiction.jurisdictionCode,
        })) ?? [],
    [jurisdictions],
  );

  const form = useForm({
    defaultValues: profileDefaultValues,
    onSubmit: async ({ value }) => {
      if (!profile || isSaving || (isAttorney && !isBarAdmissionsReady)) {
        if (isAttorney && !isBarAdmissionsReady) {
          logger.error(
            'Cannot save profile before bar admissions load succeeds',
          );
        }
        return;
      }

      setIsSaving(true);
      let saveSucceeded = false;
      let savedProfileChanges: Partial<GraphUser> = {};
      let savedAdmissions = barAdmissions;
      let admissionsWereSaved = false;
      let failureMessage =
        'We could not save your changes right now. Please try again later.';

      try {
        const original = mapProfileToFormValues(profile, barAdmissions);
        const updatedProfile: Partial<GraphUser> = {};
        if (value.firstName !== original.firstName) {
          updatedProfile.givenName = value.firstName;
        }
        if (value.lastName !== original.lastName) {
          updatedProfile.surname = value.lastName;
        }
        if (value.streetAddress !== original.streetAddress) {
          updatedProfile.streetAddress = value.streetAddress;
        }
        if (value.city !== original.city) {
          updatedProfile.city = value.city;
        }
        if (value.state !== original.state) {
          updatedProfile.state = value.state;
        }
        if (value.postalCode !== original.postalCode) {
          updatedProfile.postalCode = value.postalCode;
        }
        if (value.country !== original.country) {
          updatedProfile.country = value.country;
        }
        if (value.isAttorney !== original.isAttorney) {
          updatedProfile.isAttorney =
            value.isAttorney;
        }

        const mobilePhone = value.phone.trim();
        const phoneChanged = mobilePhone !== original.phone.trim();
        const admissionsChanged =
          (original.isAttorney || value.isAttorney) &&
          (value.isAttorney !== original.isAttorney ||
            JSON.stringify(value.barAdmissions) !==
              JSON.stringify(barAdmissions));

        logger.info('Profile update submitted');

        let apiTokenPromise: Promise<string> | null = null;
        const getApiToken = () => {
          apiTokenPromise ??= getToken(SCOPES);
          return apiTokenPromise;
        };
        const patchProfile = async (changes: Partial<GraphUser>) => {
          const token = await getApiToken();
          return fetch('/api/accounts/profile', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(changes),
          });
        };

        if (phoneChanged) {
          const response = await patchProfile({
            mobilePhone: mobilePhone || null,
          });
          if (!response.ok) {
            logger.error('Failed to update mobile phone:', await response.text());
            failureMessage =
              'Your mobile phone number could not be updated. Please sign out and sign in again, then retry.';
            return;
          }
          savedProfileChanges.mobilePhone = mobilePhone || null;
        }

        if (Object.keys(updatedProfile).length > 0) {
          const response = await patchProfile(updatedProfile);
          if (!response.ok) {
            logger.error('Failed to update profile:', await response.text());
            failureMessage =
              'Your other profile details could not be updated. Please try again later.';
            return;
          }
          savedProfileChanges = {
            ...savedProfileChanges,
            ...updatedProfile,
          };
        }

        if (admissionsChanged) {
          const token = await getApiToken();
          const admissionsResponse = await fetch(
            '/api/accounts/profile/bar-admissions',
            {
              method: value.isAttorney ? 'PUT' : 'DELETE',
              headers: {
                ...(value.isAttorney
                  ? { 'Content-Type': 'application/json' }
                  : {}),
                Authorization: `Bearer ${token}`,
              },
              body: value.isAttorney
                ? JSON.stringify({ barAdmissions: value.barAdmissions })
                : undefined,
            },
          );
          if (!admissionsResponse.ok) {
            logger.error(
              'Failed to update bar admissions:',
              await admissionsResponse.text(),
            );
            failureMessage =
              'Your bar admissions could not be updated. Please try again later.';
            return;
          }

          savedAdmissions = value.isAttorney
            ? BarAdmissionsResponseSchema.parse(
              await admissionsResponse.json(),
            ).barAdmissions
            : [];
          admissionsWereSaved = true;
        }

        saveSucceeded = true;
      } catch (error) {
        logger.error('Error updating profile:', error);
      } finally {
        const partiallySaved =
          Object.keys(savedProfileChanges).length > 0 || admissionsWereSaved;
        if (saveSucceeded || partiallySaved) {
          const mergedProfile = parseGraphUser({
            ...profile,
            ...savedProfileChanges,
          });
          setProfile(mergedProfile);
          setBarAdmissions(savedAdmissions);
          setCachedProfile(mergedProfile);
          if (saveSucceeded) {
            form.reset(mapProfileToFormValues(mergedProfile, savedAdmissions));
            setIsEditable(false);
          }
        }
        setIsSaving(false);
        setSaveResult({
          open: true,
          success: saveSucceeded,
          title: saveSucceeded
            ? 'Changes Saved'
            : partiallySaved
              ? 'Partially Saved'
              : 'Save Failed',
          message: saveSucceeded
            ? 'Your profile changes were saved successfully.'
            : partiallySaved
              ? `Some changes were saved. ${failureMessage}`
              : failureMessage,
        });
      }
    },
  });

  const handlePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      setUploadingPhoto(false);
      return;
    }

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const response = await fetchWithAuth('/api/accounts/profile/photo', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        logger.error('Failed to update profile photo:', await response.text());
        return;
      }

      invalidateCachedProfilePhoto();
      const photoUrl = await getProfilePhoto();
      setProfilePhoto(photoUrl);
      if (photoUrl) {
        emitNotification('photo:updated', { photoUrl: photoUrl! });
      } else {
        logger.error('Profile photo updated but no photo URL was returned.');
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  useEffect(() => {
    if (uploadingPhoto && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [uploadingPhoto]);

  useEffect(() => {
    if (isLoadingPhoto || profilePhoto !== undefined || isPhotoLoaded) {
      return;
    }
    logger.info('Loading profile photo...');
    setIsLoadingPhoto(true);
    if (account) {
      (async () => {
        try {
          const photoUrl = await getProfilePhoto();
          setProfilePhoto(photoUrl);
          setIsPhotoLoaded(true);
        } catch (error) {
          setProfilePhoto(null);
          setIsPhotoLoaded(true);
          logger.error('Error fetching profile or photo:', error);
        } finally {
          setIsLoadingPhoto(false);
        }
      })();
    }
  }, [isLoadingPhoto, profilePhoto, account, getProfilePhoto, isPhotoLoaded]);

  useEffect(() => {
    if (profile !== null || isLoadingProfile || isProfileLoaded) {
      return;
    }
    setIsLoadingProfile(true);

    if (account) {
      (async () => {
        try {
          const userProfile = await getProfile();
          logger.info('Fetched user profile:', userProfile);
          setProfile(userProfile);
          setIsProfileLoaded(true);
        } catch (error) {
          setProfile(null);
          logger.error('Error fetching profile or photo:', error);
        } finally {
          setIsLoadingProfile(false);
        }
      })();
    }
  }, [account, getProfile, profile, isLoadingProfile, isProfileLoaded]);

  useEffect(() => {
    let cancelled = false;
    if (!jurisdictionsRequest.current) {
      jurisdictionsRequest.current = fetch('/api/jurisdictions', {
        cache: 'no-store',
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to load jurisdiction reference data: ${response.status} ${response.statusText}`,
          );
        }

        return JurisdictionsResponseSchema.parse(await response.json());
      });
    }

    jurisdictionsRequest.current
      .then((result) => {
        if (!cancelled) {
          setJurisdictions(result);
          setJurisdictionsError(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setJurisdictionsError(true);
          logger.error('Failed to load jurisdiction reference data:', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!profile || isEditable) {
      return;
    }

    form.reset(mapProfileToFormValues(profile, barAdmissions));
  }, [profile, barAdmissions, isEditable, form]);

  useEffect(() => {
    if (
      !account ||
      !profile ||
      !isAttorney ||
      barAdmissionsLoadState === 'success' ||
      (barAdmissionsLoadState === 'error' && barAdmissionsRequest.current)
    ) {
      return;
    }

    let cancelled = false;
    if (!barAdmissionsRequest.current) {
      setBarAdmissionsLoadState('loading');
      barAdmissionsRequest.current = (async () => {
        const response = await fetchWithAuth(
          '/api/accounts/profile/bar-admissions',
          { method: 'GET', cache: 'no-store' },
        );
        if (!response.ok) {
          throw new Error(
            `Failed to load bar admissions: ${response.status} ${response.statusText}`,
          );
        }

        return BarAdmissionsResponseSchema.parse(await response.json())
          .barAdmissions;
      })();
    }

    const request = barAdmissionsRequest.current;
    request
      .then((result) => {
        if (!cancelled) {
          setBarAdmissions(result);
          setBarAdmissionsLoadState('success');
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setBarAdmissionsLoadState('error');
          logger.error('Failed to load bar admissions:', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    account,
    barAdmissionsLoadState,
    fetchWithAuth,
    isAttorney,
    profile,
  ]);

  const retryBarAdmissionsLoad = () => {
    if (isSaving || barAdmissionsLoadState !== 'error') {
      return;
    }

    barAdmissionsRequest.current = null;
    setBarAdmissionsLoadState('idle');
  };

  const startEditMode = () => {
    if (!profile || isSaving || (isAttorney && !isBarAdmissionsReady)) {
      return;
    }

    form.reset(mapProfileToFormValues(profile, barAdmissions));
    setIsEditable(true);
  };

  useEffect(() => {
    if (isEditable) {
      firstNameInputRef.current?.focus();
    }
  }, [isEditable]);

  useEffect(() => {
    if (wasSaveResultOpenRef.current && !saveResult.open) {
      requestAnimationFrame(() => {
        (isEditable ? saveButtonRef.current : editButtonRef.current)?.focus();
      });
    }
    wasSaveResultOpenRef.current = saveResult.open;
  }, [isEditable, saveResult.open]);

  const handleCancel = () => {
    if (isSaving) {
      return;
    }

    if (form.state.isDirty) {
      setIsCancelDialogOpen(true);
      return;
    }

    setIsEditable(false);
    requestAnimationFrame(() => editButtonRef.current?.focus());
  };

  const handleCancelDialogClose = (confirmed: boolean) => {
    setIsCancelDialogOpen(false);

    if (confirmed) {
      router.push('/');
    }
  };

  useEffect(() => {
    (async () => {
      if (!account) {
        signIn();
      }
    })();
  }, [account, signIn]);

  const firstInitial = profile?.givenName?.[0] ?? 'U';
  const lastInitial = profile?.surname?.[0] ?? '';
  const memberSince = formatDateTimeForLocale(profile?.createdDateTime);
  const displayFirstName = profile?.givenName ?? '';
  const displayLastName = profile?.surname ?? '';
  const displayPhone = String(profile?.mobilePhone ?? '');
  const displayStreetAddress = profile?.streetAddress ?? '';
  const displayCity = profile?.city ?? '';
  const displayState = profile?.state ?? '';
  const displayPostalCode = profile?.postalCode ?? '';
  const displayCountry = profile?.country ?? '';
  const displayIsAttorney = isAttorney;

  return (
    <PageTemplate
      title="User Profile"
      maxWidthClassName="max-w-6xl"
      isLoading={isPhotoLoaded && isProfileLoaded ? false : true}>
      {account && profile && (
        <form
          aria-busy={isSaving}
          className={`mx-auto mt-1 w-full max-w-6xl space-y-10 rounded-lg p-4 transition-colors sm:p-6 ${isEditable ? 'ring-2 ring-indigo-500/70 bg-indigo-50/40 dark:bg-indigo-950/30 dark:ring-indigo-300/70' : 'ring-1 ring-gray-200 dark:bg-gray-900/30 dark:ring-gray-400/60'}`}
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isSaving) {
              return;
            }
            void form.handleSubmit();
          }}>
          <FormSection title="Profile Photo" description="Choose the photo shown with your profile.">
            <div className="col-span-full">
              <button
                type="button"
                aria-label="Upload profile photo"
                onClick={() => {
                  if (isSaving) {
                    return;
                  }
                  setUploadingPhoto(true);
                }}
                className="hover:cursor-pointer"
                disabled={isSaving}>
                {profilePhoto ? (
                  <Image
                    src={profilePhoto || ''}
                    alt="Profile Photo"
                    width={240}
                    height={240}
                    className="rounded-full"
                  />
                ) : (
                  <div className="bg-blue-500 rounded-full w-24 h-24 flex items-center justify-center text-2xl hover:cursor-pointer">
                    {firstInitial}
                    {lastInitial}
                  </div>
                )}
              </button>
            </div>
          </FormSection>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handlePhotoUpload}
            style={{ display: 'none' }}
          />
          <FormSection title="Personal Information" description="Your contact details and account information." fieldsClassName="block">
            <div className="col-span-full">
              <label
                htmlFor="memberSince"
                className="block text-sm/6 font-medium text-gray-900 dark:text-white">
                Member Since
              </label>
              <input
                type="text"
                id="memberSince"
                name="memberSince"
                className="mt-2 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
                value={memberSince}
                readOnly
              />
            </div>
            <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label
                  htmlFor="firstName"
                  className="block text-sm/6 font-medium text-gray-900 dark:text-white">
                  First Name
                </label>
                <form.Field name="firstName">
                  {(field) => (
                    <input
                      ref={firstNameInputRef}
                      type="text"
                      id="firstName"
                      name="firstName"
                      className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500 mt-2"
                      value={isEditable ? field.state.value : displayFirstName}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      readOnly={!isEditable}
                    />
                  )}
                </form.Field>
              </div>
              <div className="sm:col-span-3">
                <label
                  htmlFor="lastName"
                  className="block text-sm/6 font-medium text-gray-900 dark:text-white">
                  Last Name
                </label>
                <form.Field name="lastName">
                  {(field) => (
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                      value={isEditable ? field.state.value : displayLastName}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      readOnly={!isEditable}
                    />
                  )}
                </form.Field>
              </div>
              <div className="col-span-full">
                <label
                  htmlFor="email"
                  className="block text-sm/6 font-medium text-gray-900 dark:text-white">
                  Email
                </label>
                <input
                  type="text"
                  id="email"
                  name="email"
                  className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400  sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500"
                  value={profile?.mail || profile?.userPrincipalName || ''}
                  readOnly
                />
              </div>
              <div className="col-span-full">
                <label
                  htmlFor="phone"
                  className="block text-sm/6 font-medium text-gray-900 dark:text-white">
                  Phone
                </label>
                <form.Field name="phone">
                  {(field) => (
                    <input
                      type="text"
                      id="phone"
                      name="phone"
                      className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                      value={isEditable ? field.state.value : displayPhone}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      readOnly={!isEditable}
                    />
                  )}
                </form.Field>
              </div>
              <div className="col-span-full">
                <label
                  htmlFor="streetAddress"
                  className="block text-sm/6 font-medium text-gray-900 dark:text-white">
                  Street Address
                </label>
                <form.Field name="streetAddress">
                  {(field) => (
                    <input
                      type="text"
                      id="streetAddress"
                      name="streetAddress"
                      className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                      value={isEditable ? field.state.value : displayStreetAddress}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      readOnly={!isEditable}
                    />
                  )}
                </form.Field>
              </div>
              <div className="sm:col-span-3">
                <label
                  htmlFor="city"
                  className="block text-sm/6 font-medium text-gray-900 dark:text-white">
                  City
                </label>
                <form.Field name="city">
                  {(field) => (
                    <input
                      type="text"
                      id="city"
                      name="city"
                      className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                      value={isEditable ? field.state.value : displayCity}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      readOnly={!isEditable}
                    />
                  )}
                </form.Field>
              </div>
              <div className="sm:col-span-3">
                <label
                  htmlFor="state"
                  className="block text-sm/6 font-medium text-gray-900 dark:text-white">
                  State, territory, or district
                </label>
                <form.Field name="state">
                  {(field) => (
                    <SearchableSelect
                      ariaLabel="State, territory, or district"
                      id="state"
                      options={stateOptions}
                      placeholder="Search states..."
                      value={isEditable ? field.state.value : displayState}
                      onChange={field.handleChange}
                      disabled={!isEditable || isSaving}
                    />
                  )}
                </form.Field>
              </div>
              <div className="sm:col-span-3">
                <label
                  htmlFor="postalCode"
                  className="block text-sm/6 font-medium text-gray-900 dark:text-white">
                  Postal Code
                </label>
                <form.Field name="postalCode">
                  {(field) => (
                    <input
                      type="text"
                      id="postalCode"
                      name="postalCode"
                      className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                      value={isEditable ? field.state.value : displayPostalCode}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      readOnly={!isEditable}
                    />
                  )}
                </form.Field>
              </div>
              <div className="sm:col-span-3">
                <label
                  htmlFor="country"
                  className="block text-sm/6 font-medium text-gray-900 dark:text-white">
                  Country
                </label>
                <form.Field name="country">
                  {(field) => (
                    <input
                      type="text"
                      id="country"
                      name="country"
                      className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
                      value={isEditable ? field.state.value : displayCountry}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      readOnly={!isEditable}
                    />
                  )}
                </form.Field>
              </div>
            </div>
          </FormSection>
          <FormSection title="Professional Information" description="Attorney status and jurisdictions where you practice." fieldsClassName="block">
            <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
              <div className="col-span-full">
                <label
                  htmlFor="isAttorney"
                  className="block text-sm/6 font-medium text-gray-900 dark:text-white">
                  Is Attorney
                </label>
                <div className="group relative inline-flex w-11 shrink-0 rounded-full bg-gray-200 p-0.5 inset-ring inset-ring-gray-900/5 outline-offset-2 outline-indigo-600 transition-colors duration-200 ease-in-out has-checked:bg-indigo-600 has-focus-visible:outline-2 dark:bg-white/5 dark:inset-ring-white/10 dark:outline-indigo-500 dark:has-checked:bg-indigo-500">
                  <span className="size-5 rounded-full bg-white shadow-xs ring-1 ring-gray-900/5 transition-transform duration-200 ease-in-out group-has-checked:translate-x-5" />
                  <form.Field name="isAttorney">
                    {(field) => (
                      <input
                        type="checkbox"
                        id="isAttorney"
                        name="isAttorney"
                        className="mt-2 absolute inset-0 appearance-none focus:outline-hidden"
                        checked={isEditable ? field.state.value : displayIsAttorney}
                        onChange={(e) => field.handleChange(e.target.checked)}
                        onBlur={field.handleBlur}
                        disabled={!isEditable}
                      />
                    )}
                  </form.Field>
                </div>
              </div>
              <form.Field name="isAttorney">
                {(attorneyField) => {
                  const showBarAdmissions = isEditable
                    ? attorneyField.state.value
                    : displayIsAttorney;

                  if (!showBarAdmissions) {
                    return null;
                  }

                  return (
                    <form.Field name="barAdmissions">
                      {(field) =>
                        isBarAdmissionsReady ? (
                          <BarAdmissionsEditor
                            admissions={field.state.value}
                            isEditable={isEditable}
                            disabled={isSaving}
                            jurisdictions={jurisdictions}
                            referenceDataError={jurisdictionsError}
                            onChange={field.handleChange}
                          />
                        ) : (
                          <section
                            aria-labelledby="bar-admissions-heading"
                            className="col-span-full border-t border-gray-900/10 pt-8 dark:border-white/10">
                            <h2
                              id="bar-admissions-heading"
                              className="text-base font-semibold text-gray-900 dark:text-white">
                              Bar Admissions
                            </h2>
                            <p
                              role="status"
                              className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                              {barAdmissionsLoadState === 'error'
                                ? 'Bar admissions could not be loaded. Editing is unavailable until the existing admissions are loaded successfully.'
                                : 'Loading bar admissions...'}
                            </p>
                            {barAdmissionsLoadState === 'error' && (
                              <Button
                                type="button"
                                className="mt-3 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                                onClick={retryBarAdmissionsLoad}
                                disabled={isSaving}>
                                Try again
                              </Button>
                            )}
                          </section>
                        )
                      }
                    </form.Field>
                  );
                }}
              </form.Field>
            </div>
          </FormSection>
          <FormActions>
            <Button
              ref={editButtonRef}
              type="button"
              className="rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500"
              onClick={startEditMode}
              hidden={isEditable}
              disabled={isSaving || !isBarAdmissionsReady}>
              Edit
            </Button>
            <div className="flex gap-3" hidden={!isEditable}>
              <Button
                type="button"
                className="rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-xs inset-ring-1 inset-ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white/10 dark:text-white dark:shadow-none dark:inset-ring-white/5 dark:hover:bg-white/20"
                onClick={handleCancel}
                disabled={isSaving}>
                Cancel
              </Button>
              <Button
                ref={saveButtonRef}
                type="submit"
                disabled={isSaving}
                className="rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500">
                Save Changes
              </Button>
            </div>
          </FormActions>
        </form>
      )}
      {isSaving && (
        <Dialog
          open={isSaving}
          onClose={() => undefined}
          className="relative z-[1000]">
          <DialogBackdrop className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" />
          <div className="fixed inset-0 z-10 flex items-center justify-center p-4">
            <DialogPanel
              tabIndex={-1}
              aria-busy="true"
              className="rounded-lg bg-white px-6 py-4 shadow-xl dark:bg-gray-800 dark:outline dark:-outline-offset-1 dark:outline-white/10">
              <DialogTitle as="h2" className="sr-only">
                Saving profile
              </DialogTitle>
              <p
                role="status"
                aria-live="assertive"
                className="text-sm font-medium text-gray-900 dark:text-white">
                Saving your profile data. Please wait...
              </p>
            </DialogPanel>
          </div>
        </Dialog>
      )}
      <Dialog
        open={saveResult.open}
        onClose={() =>
          setSaveResult((previous) => ({ ...previous, open: false }))
        }
        className="relative z-[1001]">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in dark:bg-gray-900/50"
        />
        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel
              transition
              className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 sm:w-full sm:max-w-lg sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95 dark:bg-gray-800 dark:outline dark:-outline-offset-1 dark:outline-white/10">
              <div className="mt-3 text-center sm:mt-2">
                <DialogTitle
                  as="h3"
                  className="text-base font-semibold text-gray-900 dark:text-white">
                  {saveResult.title}
                </DialogTitle>
                <div className="mt-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {saveResult.message}
                  </p>
                </div>
              </div>
              <div className="mt-5 sm:mt-6">
                <button
                  type="button"
                  onClick={() =>
                    setSaveResult((previous) => ({ ...previous, open: false }))
                  }
                  className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500">
                  OK
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
      <ConfirmationDialog
        title="Discard unsaved changes?"
        description="You have unsaved changes. Are you sure you want to leave this page?"
        confirmButtonText="Leave"
        cancelButtonText="Stay"
        defaultOpen={isCancelDialogOpen}
        onClose={handleCancelDialogClose}
      />
    </PageTemplate>
  );
}
